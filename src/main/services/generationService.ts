import { readFile } from 'node:fs/promises'
import { AppError } from '../../shared/errors'
import {
  extractJsonObject,
  OLLAMA_SPEC_JSON_SCHEMA,
  parseProjectSpec,
  parseSpecJson,
  SPEC_FILENAME,
  type ProjectSpec
} from '../../shared/spec'
import { inferSpecFromPrompt, promptLooksComplex } from '../../shared/templateInfer'
import type { AppSettings, ProjectRecord } from '../../shared/types'
import { isBuildScriptPath } from '../codegen/allowlist'
import { attachGeneratedTextures } from '../codegen/pack/planner'
import { assertCanGenerate, planAdapterFiles } from '../codegen/plan'
import { diffPlannedFiles, writePlannedFiles, type FileChange } from './filePlan'
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

const SYSTEM_PROMPT = `You emit ONLY a JSON object for CraftStudio Local.
Rules:
- schemaVersion must be 1
- items: 1-8 simple custom items (id lowercase [a-z0-9_])
- recipes: shapeless only; vanilla ingredients must be minecraft: ids from a small allowlist (stick, cobblestone, stone, dirt, iron_ingot, ...)
- commands: names only; they will not be implemented
- mobs: optional; only presets passive_wanderer | hostile_melee | neutral_flee | avoid_players | stationary_lookout
- modGuis / pluginGuis: optional simple layouts (labels, buttons, slots)
- Put blocks, worldgen, full behavior trees in unsupportedRequests
- Never include file paths, shell commands, Gradle, or Java source
- source must be "ollama"
- packageName like local.craftstudio.mod_id
- mainClass PascalCase`

export class GenerationService {
  constructor(
    private readonly projects: ProjectService,
    private readonly settings: SettingsService,
    private readonly ollama: OllamaService
  ) {}

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
    const record = await this.projects.get(projectId)
    assertCanGenerate(record.manifest.platform, record.manifest.minecraftVersion)

    const settings = await this.settings.get()
    const text = prompt.trim() || record.manifest.description || record.manifest.name
    options.onProgress?.({ stage: 'infer', message: 'Building a trusted template spec…' })
    const templateSpec = inferSpecFromPrompt(record.manifest, text)

    const wantsModel = mode === 'ollama' || (mode === 'auto' && promptLooksComplex(text))
    if (!wantsModel) {
      options.onProgress?.({ stage: 'validate', message: 'Validating template spec…' })
      const spec = parseProjectSpec(templateSpec)
      options.onProgress?.({ stage: 'done', message: 'Template specification is valid.' })
      return {
        spec,
        usedOllama: false,
        repairAttempts: 0,
        remainingProblems: spec.unsupportedRequests.map((item) => `${item.feature}: ${item.reason}`),
        ollamaNote: wantsModel
          ? 'Template-only mode was selected. Ollama was not called.'
          : 'Simple request covered by trusted templates. Ollama was not required.',
        success: true
      }
    }

    return await this.generateWithOllama(record, text, templateSpec, settings, options.model, options.onProgress)
  }

  async previewApply(projectId: string, specInput: unknown): Promise<ApplyPreview> {
    const record = await this.projects.get(projectId)
    assertCanGenerate(record.manifest.platform, record.manifest.minecraftVersion)
    const spec = parseProjectSpec(specInput)
    const root = (await this.settings.get()).projectsPath
    const textures = await loadProjectTextures(root, record.directoryName, spec.items.map((item) => item.id))
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
      preview.spec.items.map((item) => item.id)
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
    await this.projects.update(projectId, {
      features: {
        customItems: preview.spec.items.length > 0,
        recipes: preview.spec.recipes.length > 0,
        customMobs: preview.spec.mobs.length > 0,
        customGuis: preview.spec.modGuis.length > 0 || preview.spec.pluginGuis.length > 0
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
    onProgress?: (event: GenerationProgress) => void
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
        success: true
      }
    }

    onProgress?.({ stage: 'ollama', message: `Asking local model ${model} for a JSON spec…` })
    let raw: string
    try {
      raw = await this.ollama.chatJson({
        endpoint: settings.ollamaEndpoint,
        model,
        timeoutMs: settings.ollamaGenerateTimeoutMs,
        numPredict: settings.ollamaNumPredict,
        numCtx: settings.ollamaNumCtx,
        format: OLLAMA_SPEC_JSON_SCHEMA,
        onChunk: () => onProgress?.({ stage: 'ollama', message: 'Streaming model tokens…' }),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Minecraft ${record.manifest.minecraftVersion} Fabric project "${record.manifest.name}".\nUser request:\n${prompt}\n\nTemplate hint (you may refine, do not add file paths):\n${JSON.stringify(fallback)}`
          }
        ]
      })
    } catch (error) {
      if (error instanceof AppError && error.code === 'GENERATION_CANCELLED') {
        throw error
      }
      onProgress?.({
        stage: 'done',
        message: 'Ollama unavailable. Keeping the trusted template spec.'
      })
      return {
        spec: fallback,
        usedOllama: false,
        repairAttempts: 0,
        remainingProblems: [error instanceof Error ? error.message : String(error)],
        ollamaNote:
          'Ollama did not respond. CraftStudio used trusted templates only. No cloud fallback was attempted.',
        success: true
      }
    }

    const attempts = settings.maxRepairAttempts
    let current = raw
    let repairAttempts = 0
    let lastError = ''

    while (repairAttempts <= attempts) {
      onProgress?.({ stage: 'validate', message: 'Independently validating model JSON…' })
      try {
        const spec = parseProjectSpec({
          ...fallback,
          ...Object(extractJsonObject(current)),
          source: 'merged',
          prompt
        })
        onProgress?.({ stage: 'done', message: 'Validated specification from Ollama + schema checks.' })
        return {
          spec,
          usedOllama: true,
          repairAttempts,
          remainingProblems: spec.unsupportedRequests.map((item) => `${item.feature}: ${item.reason}`),
          ollamaNote: 'Model output was independently validated. Success is the schema, not the model saying it worked.',
          success: true
        }
      } catch (error) {
        lastError = error instanceof AppError ? error.details ?? error.message : String(error)
        if (repairAttempts >= attempts) {
          break
        }
        repairAttempts += 1
        onProgress?.({
          stage: 'repair',
          message: `Repair attempt ${repairAttempts}/${attempts}…`
        })
        current = await this.ollama.chatJson({
          endpoint: settings.ollamaEndpoint,
          model,
          timeoutMs: settings.ollamaGenerateTimeoutMs,
          numPredict: settings.ollamaNumPredict,
          numCtx: settings.ollamaNumCtx,
          format: 'json',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
            { role: 'assistant', content: current },
            {
              role: 'user',
              content: `The spec failed validation:\n${lastError}\nReturn a corrected JSON object only.`
            }
          ]
        })
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
        'Trusted template spec is shown instead. Review it before applying files.'
      ],
      ollamaNote: `Repair budget exhausted (${attempts}). Model garbage was not written to disk.`,
      success: true
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
