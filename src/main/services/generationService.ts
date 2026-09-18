import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { previewText } from '../../shared/activity'
import { AppError } from '../../shared/errors'
import {
  compactTemplateHint,
  isResourceExhaustionMessage,
  OLLAMA_PROMPT_USER_CAP,
  OLLAMA_REPAIR_ASSISTANT_CAP
} from '../../shared/ollamaLimits'
import {
  extractJsonObject,
  OLLAMA_SPEC_JSON_SCHEMA,
  parseProjectSpec,
  parseSpecJson,
  SPEC_FILENAME,
  type ProjectSpec
} from '../../shared/spec'
import { describeOllamaWireFormat } from '../../shared/ollamaSpecSchema'
import { SPEC_REPAIR_CONSTRAINTS, SPEC_SYSTEM_PROMPT } from '../../shared/specPrompt'
import { collectUnsupportedFromPrompt, inferSpecFromPrompt, promptLooksComplex } from '../../shared/templateInfer'
import type { AppSettings, ProjectRecord } from '../../shared/types'
import { isBuildScriptPath } from '../codegen/allowlist'
import { attachGeneratedTextures } from '../codegen/pack/planner'
import { assertCanGenerate, planAdapterFiles } from '../codegen/plan'
import { diffPlannedFiles, writePlannedFiles, type FileChange } from './filePlan'
import type { ActivityService } from './activityService'
import { OllamaService } from './ollamaService'
import { resolveProjectFile } from './pathSafety'
import type { ProjectService } from './projectService'
import type { SettingsService } from './settingsService'
import { createProjectSnapshot, removeOldestSnapshots } from './snapshotService'
import { loadProjectTextures } from './textureService'

export type GenerationMode = 'auto' | 'template' | 'ollama'

export interface GenerationProgress {
  stage: 'infer' | 'ollama' | 'repair' | 'validate' | 'plan' | 'done'
  message: string
}

export interface GenerationResult {
  spec: ProjectSpec
  usedOllama: boolean
  repairAttempts: number
  remainingProblems: string[]
  ollamaNote: string | null
  success: true
  requestId: string
}

export interface ApplyPreview {
  spec: ProjectSpec
  changes: FileChange[]
  overwriteCount: number
  buildScriptChanges: string[]
}

export interface ApplyResult extends ApplyPreview {
  applied: boolean
}

function mergeUnsupported(spec: ProjectSpec, extras: { feature: string; reason: string }[]): ProjectSpec {
  const existing = new Set(spec.unsupportedRequests.map((item) => item.feature))
  const added = extras.filter((item) => !existing.has(item.feature))
  if (added.length === 0) {
    return spec
  }
  return { ...spec, unsupportedRequests: [...spec.unsupportedRequests, ...added] }
}

export class GenerationService {
  private activeRequestId: string | null = null

  constructor(
    private readonly projects: ProjectService,
    private readonly settings: SettingsService,
    private readonly ollama: OllamaService,
    private readonly activity?: ActivityService
  ) {}

  cancelGeneration(): void {
    this.activeRequestId = null
    this.ollama.cancelInference()
  }

  private isCurrent(requestId: string): boolean {
    return this.activeRequestId === requestId
  }

  async getSpec(projectId: string): Promise<ProjectSpec | null> {
    const record = await this.projects.get(projectId)
    const root = (await this.settings.get()).projectsPath
    try {
      const raw = await readFile(resolveProjectFile(root, record.directoryName, SPEC_FILENAME), 'utf8')
      return parseSpecJson(raw)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      if (error instanceof AppError) {
        throw error
      }
      return null
    }
  }

  async generateSpec(
    projectId: string,
    prompt: string,
    mode: GenerationMode,
    options: {
      model?: string
      onProgress?: (event: GenerationProgress) => void
    } = {}
  ): Promise<GenerationResult> {
    if (this.activeRequestId) {
      throw new AppError({
        code: 'INFERENCE_BUSY',
        message: 'A specification generation is already running.',
        action: 'Cancel it or wait. CraftStudio does not overlap inference.'
      })
    }
    const requestId = randomUUID()
    this.activeRequestId = requestId
    try {
      const record = await this.projects.get(projectId)
      assertCanGenerate(record.manifest.platform, record.manifest.minecraftVersion)

      const settings = await this.settings.get()
      const text = prompt.trim() || record.manifest.description || record.manifest.name
      const human = `Requesting the ${record.manifest.name} specification.`
      options.onProgress?.({ stage: 'infer', message: human })
      this.activity?.record({
        channel: 'ai',
        requestId,
        title: human,
        status: 'running',
        detail: `mode=${mode}`
      })
      const templateSpec = inferSpecFromPrompt(record.manifest, text)

      const wantsModel = mode === 'ollama' || (mode === 'auto' && promptLooksComplex(text))
      if (!wantsModel) {
        options.onProgress?.({ stage: 'validate', message: 'Validating the trusted template specification.' })
        const spec = parseProjectSpec(templateSpec)
        if (!this.isCurrent(requestId)) {
          throw new AppError({
            code: 'GENERATION_CANCELLED',
            message: 'Generation was cancelled.',
            action: 'Generate again if you still want a spec.'
          })
        }
        options.onProgress?.({ stage: 'done', message: 'Template specification is valid.' })
        this.activity?.record({
          channel: 'results',
          requestId,
          title: 'Validated the trusted template specification.',
          status: 'success'
        })
        return {
          spec,
          usedOllama: false,
          repairAttempts: 0,
          remainingProblems: spec.unsupportedRequests.map((item) => `${item.feature}: ${item.reason}`),
          ollamaNote: wantsModel
            ? 'Template-only mode was selected. Ollama was not called.'
            : 'Simple request covered by trusted templates. Ollama was not required.',
          success: true,
          requestId
        }
      }

      return await this.generateWithOllama(
        record,
        text,
        templateSpec,
        settings,
        options.model,
        options.onProgress,
        requestId
      )
    } finally {
      if (this.activeRequestId === requestId) {
        this.activeRequestId = null
      }
    }
  }

  async previewApply(projectId: string, specInput: unknown): Promise<ApplyPreview> {
    const record = await this.projects.get(projectId)
    assertCanGenerate(record.manifest.platform, record.manifest.minecraftVersion)
    const spec = parseProjectSpec(specInput)
    const root = (await this.settings.get()).projectsPath
    const textures = await loadProjectTextures(root, record.directoryName, [
      ...spec.items.map((item) => item.id),
      ...spec.blocks.map((block) => block.id)
    ])
    const files = attachGeneratedTextures(planAdapterFiles(record.manifest, spec), record.manifest, spec, textures)
    const specFile = {
      relativePath: SPEC_FILENAME,
      contents: `${JSON.stringify(spec, null, 2)}\n`,
      encoding: 'utf8' as const
    }
    const changes = await diffPlannedFiles(root, record.directoryName, [specFile, ...files])
    return {
      spec,
      changes,
      overwriteCount: changes.filter((change) => change.action === 'overwrite').length,
      buildScriptChanges: changes
        .filter((change) => change.buildScript && change.action !== 'unchanged')
        .map((change) => change.relativePath)
    }
  }

  async applySpec(projectId: string, specInput: unknown, confirmOverwrites: boolean): Promise<ApplyResult> {
    const preview = await this.previewApply(projectId, specInput)
    const gated = preview.changes.filter((change) => change.buildScript && change.action === 'overwrite')
    if (gated.length > 0 && !confirmOverwrites) {
      return { ...preview, applied: false }
    }
    if (preview.overwriteCount > 0 && !confirmOverwrites) {
      return { ...preview, applied: false }
    }

    const record = await this.projects.get(projectId)
    const root = (await this.settings.get()).projectsPath
    const textures = await loadProjectTextures(
      root,
      record.directoryName,
      [...preview.spec.items.map((item) => item.id), ...preview.spec.blocks.map((block) => block.id)]
    )
    const files = attachGeneratedTextures(
      planAdapterFiles(record.manifest, preview.spec),
      record.manifest,
      preview.spec,
      textures
    )
    const specFile = {
      relativePath: SPEC_FILENAME,
      contents: `${JSON.stringify(preview.spec, null, 2)}\n`,
      encoding: 'utf8' as const
    }
    await createProjectSnapshot(root, record.directoryName, 'before-apply', {
      platform: record.manifest.platform,
      minecraftVersion: record.manifest.minecraftVersion
    })
    await removeOldestSnapshots(root, record.directoryName)
    await writePlannedFiles(root, record.directoryName, [specFile, ...files])
    for (const change of preview.changes.filter((item) => item.action !== 'unchanged')) {
      this.activity?.record({
        channel: 'files',
        title:
          change.action === 'create'
            ? `Writing ${change.relativePath}.`
            : `Updating ${change.relativePath}.`,
        path: change.relativePath,
        detail: change.summary,
        status: 'success'
      })
    }
    await this.projects.update(projectId, {
      features: {
        customItems: preview.spec.items.length > 0,
        recipes: preview.spec.recipes.length > 0,
        customMobs: preview.spec.mobs.length > 0,
        customGuis: preview.spec.modGuis.length > 0 || preview.spec.pluginGuis.length > 0,
        customBlocks: preview.spec.blocks.length > 0
      }
    })
    return { ...preview, applied: true }
  }

  private async generateWithOllama(
    record: ProjectRecord,
    prompt: string,
    fallback: ProjectSpec,
    settings: AppSettings,
    modelOverride: string | undefined,
    onProgress: ((event: GenerationProgress) => void) | undefined,
    requestId: string
  ): Promise<GenerationResult> {
    const model = modelOverride ?? settings.ollamaModel
    if (!model) {
      onProgress?.({
        stage: 'done',
        message: 'No local model selected. Using the trusted template spec.'
      })
      return {
        spec: fallback,
        usedOllama: false,
        repairAttempts: 0,
        remainingProblems: [
          'Ollama model is not configured. Select an installed model in Settings, or keep the template spec.'
        ],
        ollamaNote:
          'Ollama was skipped because no model is selected. There is no cloud fallback. The template spec is still valid.',
        success: true,
        requestId
      }
    }

    const userPrompt = prompt.slice(0, OLLAMA_PROMPT_USER_CAP)
    const hint = compactTemplateHint(fallback)
    const settingsSnap = {
      model,
      numPredict: settings.ollamaNumPredict,
      numCtx: settings.ollamaNumCtx,
      temperature: 0.1,
      timeoutMs: settings.ollamaGenerateTimeoutMs,
      format: describeOllamaWireFormat(OLLAMA_SPEC_JSON_SCHEMA)
    }
    const persist = settings.persistFullAiLogs
    onProgress?.({
      stage: 'ollama',
      message: `Asking ${model} (num_ctx=${settings.ollamaNumCtx}, num_predict=${settings.ollamaNumPredict}).`
    })
    this.activity?.record({
      channel: 'ai',
      requestId,
      title: `Requesting the ${record.manifest.name} specification.`,
      status: 'running',
      model,
      settings: settingsSnap,
        messages: [
        { role: 'system', ...previewText(SPEC_SYSTEM_PROMPT, 500, persist) },
        {
          role: 'user',
          ...previewText(
            `Minecraft ${record.manifest.minecraftVersion} ${record.manifest.platform} "${record.manifest.name}". ${userPrompt} ${hint}`,
            500,
            persist
          )
        }
      ]
    })
    let streamed = ''
    let lastStreamRecord = 0
    let raw: string
    try {
      raw = await this.ollama.chatJson({
        endpoint: settings.ollamaEndpoint,
        model,
        requestId,
        operation: 'generate-spec',
        timeoutMs: settings.ollamaGenerateTimeoutMs,
        numPredict: settings.ollamaNumPredict,
        numCtx: settings.ollamaNumCtx,
        format: OLLAMA_SPEC_JSON_SCHEMA,
        onChunk: (piece) => {
          streamed = `${streamed}${piece}`.slice(-4000)
          onProgress?.({ stage: 'ollama', message: `Streaming from ${model}…` })
          const now = Date.now()
          if (now - lastStreamRecord >= 400) {
            lastStreamRecord = now
            const preview = previewText(streamed, 400, persist)
            this.activity?.record({
              channel: 'ai',
              requestId,
              title: `Streaming the ${record.manifest.name} specification.`,
              status: 'streaming',
              model,
              output: preview.content,
              outputTruncated: preview.truncated
            })
          }
        },
        messages: [
          { role: 'system', content: SPEC_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Minecraft ${record.manifest.minecraftVersion} ${record.manifest.platform} project "${record.manifest.name}".\nUser request:\n${userPrompt}\n\nTemplate ids only (do not add file paths): ${hint}`
          }
        ]
      })
    } catch (error) {
      if (error instanceof AppError && error.code === 'GENERATION_TIMEOUT') {
        this.activity?.record({
          channel: 'errors',
          requestId,
          title: 'Generation timed out.',
          status: 'timeout',
          model,
          error: error.message,
          detail: 'Bounded wait expired. This is not a manual cancel. Ollama may still be loading weights.'
        })
        throw error
      }
      if (
        error instanceof AppError &&
        (error.code === 'GENERATION_CANCELLED' ||
          error.code === 'INFERENCE_BUSY' ||
          error.code === 'OLLAMA_REQUEST_REJECTED' ||
          error.code === 'OLLAMA_UNAVAILABLE')
      ) {
        this.activity?.record({
          channel: 'errors',
          requestId,
          title:
            error.code === 'OLLAMA_REQUEST_REJECTED'
              ? `Ollama rejected the request${error.httpStatus ? ` (HTTP ${error.httpStatus})` : ''}.`
              : error.code === 'OLLAMA_UNAVAILABLE'
                ? 'Ollama is not reachable.'
                : error.message,
          status: 'failure',
          model,
          endpoint: settings.ollamaEndpoint,
          httpStatus: error.httpStatus,
          error: error.message,
          detail: [
            `endpoint=${settings.ollamaEndpoint}`,
            `requestId=${requestId}`,
            error.httpStatus ? `HTTP ${error.httpStatus}` : null,
            error.details
          ]
            .filter(Boolean)
            .join(' · ')
        })
        onProgress?.({
          stage: 'done',
          message:
            error.code === 'OLLAMA_REQUEST_REJECTED'
              ? `Ollama rejected the request${error.httpStatus ? ` (HTTP ${error.httpStatus})` : ''}. The trusted template was not used as an AI result.`
              : 'Ollama is not reachable. Use template-only generation if you want the trusted spec.'
        })
        throw error
      }
      if (!this.isCurrent(requestId)) {
        throw new AppError({
          code: 'GENERATION_CANCELLED',
          message: 'Generation was cancelled.',
          action: 'Generate again if you still want a spec.'
        })
      }
      this.activity?.record({
        channel: 'errors',
        requestId,
        title: 'Ollama did not return a specification.',
        status: 'failure',
        model,
        endpoint: settings.ollamaEndpoint,
        error: error instanceof Error ? error.message : String(error)
      })
      onProgress?.({
        stage: 'done',
        message: 'Ollama request failed. The trusted template was not used as an AI result.'
      })
      throw error instanceof AppError
        ? error
        : new AppError({
            code: 'GENERATION_FAILED',
            message: error instanceof Error ? error.message : String(error),
            action: 'Use template-only generation if you want the trusted spec. This is not an AI success.'
          })
    }

    if (!this.isCurrent(requestId)) {
      throw new AppError({
        code: 'GENERATION_CANCELLED',
        message: 'Generation was cancelled. The late response was discarded.',
        action: 'Generate again if you still want a spec.'
      })
    }

    const attempts = settings.maxRepairAttempts
    let current = raw
    let repairAttempts = 0
    let lastError = ''

    while (repairAttempts <= attempts) {
      if (!this.isCurrent(requestId)) {
        throw new AppError({
          code: 'GENERATION_CANCELLED',
          message: 'Generation was cancelled. The late response was discarded.',
          action: 'Generate again if you still want a spec.'
        })
      }
      onProgress?.({ stage: 'validate', message: 'Validating the specification JSON.' })
      try {
        const spec = mergeUnsupported(
          parseProjectSpec({
            ...fallback,
            ...Object(extractJsonObject(current)),
            source: 'merged',
            prompt
          }),
          collectUnsupportedFromPrompt(prompt)
        )
        onProgress?.({ stage: 'done', message: 'Validated specification from Ollama + schema checks.' })
        this.activity?.record({
          channel: 'results',
          requestId,
          title: 'Validated the specification.',
          status: 'success',
          output: previewText(current, 400, persist).content,
          outputTruncated: !persist && current.length > 400
        })
        return {
          spec,
          usedOllama: true,
          repairAttempts,
          remainingProblems: spec.unsupportedRequests.map((item) => `${item.feature}: ${item.reason}`),
          ollamaNote:
            'Model output was independently validated. Schema-valid is not the same as implemented mace smash, life steal, shockwaves, enchantments, or AI textures.',
          success: true,
          requestId
        }
      } catch (error) {
        lastError = error instanceof AppError ? error.details ?? error.message : String(error)
        this.activity?.record({
          channel: 'errors',
          requestId,
          title: 'Specification validation failed.',
          status: 'failure',
          error: lastError
        })
        if (repairAttempts >= attempts || isResourceExhaustionMessage(lastError)) {
          break
        }
        repairAttempts += 1
        onProgress?.({
          stage: 'repair',
          message: `Repair attempt ${repairAttempts}/${attempts}…`
        })
        try {
          current = await this.ollama.chatJson({
            endpoint: settings.ollamaEndpoint,
            model,
            requestId: `${requestId}-repair-${repairAttempts}`,
            operation: 'repair-spec',
            timeoutMs: settings.ollamaGenerateTimeoutMs,
            numPredict: settings.ollamaNumPredict,
            numCtx: settings.ollamaNumCtx,
            format: OLLAMA_SPEC_JSON_SCHEMA,
            messages: [
              { role: 'system', content: SPEC_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
              { role: 'assistant', content: current.slice(0, OLLAMA_REPAIR_ASSISTANT_CAP) },
              {
                role: 'user',
                content: `Previous JSON (do not invent gameplay; do not drop unsupported asks — move them to unsupportedRequests):\nKeep the same request. Field-level Zod errors:\n${lastError.slice(0, 1500)}\n\n${SPEC_REPAIR_CONSTRAINTS}\nReturn a corrected JSON object only.`
              }
            ]
          })
        } catch (repairError) {
          if (
            repairError instanceof AppError &&
            (repairError.code === 'GENERATION_CANCELLED' ||
              repairError.code === 'GENERATION_TIMEOUT' ||
              repairError.code === 'OLLAMA_REQUEST_REJECTED')
          ) {
            if (repairError.code === 'GENERATION_TIMEOUT') {
              this.activity?.record({
                channel: 'errors',
                requestId,
                title: 'Specification repair timed out.',
                status: 'timeout',
                model,
                error: repairError.message,
                detail: 'Bounded wait expired during repair. This is not a manual cancel.'
              })
            }
            if (repairError.code === 'OLLAMA_REQUEST_REJECTED') {
              this.activity?.record({
                channel: 'errors',
                requestId,
                title: `Ollama rejected the repair request${repairError.httpStatus ? ` (HTTP ${repairError.httpStatus})` : ''}.`,
                status: 'failure',
                model,
                endpoint: settings.ollamaEndpoint,
                httpStatus: repairError.httpStatus,
                error: repairError.message,
                detail: repairError.details
              })
            }
            throw repairError
          }
          lastError = repairError instanceof Error ? repairError.message : String(repairError)
          this.activity?.record({
            channel: 'errors',
            requestId,
            title: 'Specification repair stopped.',
            status: 'failure',
            error: lastError
          })
          break
        }
      }
    }

    onProgress?.({
      stage: 'done',
      message: 'Model output could not be repaired. Falling back to the trusted template spec.'
    })
    return {
      spec: fallback,
      usedOllama: true,
      repairAttempts,
      remainingProblems: [
        lastError || 'Model JSON never passed validation.',
        ...collectUnsupportedFromPrompt(prompt).map((item) => `${item.feature}: ${item.reason}`),
        'Trusted template spec is shown instead. This is not a completed implementation of the request. Review it before applying files.'
      ],
      ollamaNote: `Repair budget exhausted (${attempts}). Model garbage was not written to disk. Template fallback is not success for unsupported Legendary Mace-style features.`,
      success: true,
      requestId
    }
  }
}

export function summarizeBuildScriptGate(changes: FileChange[]): string {
  const names = changes.filter((change) => isBuildScriptPath(change.relativePath) && change.action !== 'unchanged')
  if (names.length === 0) {
    return 'No build script changes.'
  }
  return `Build scripts will be written from CraftStudio templates only: ${names.map((item) => item.relativePath).join(', ')}.`
}
