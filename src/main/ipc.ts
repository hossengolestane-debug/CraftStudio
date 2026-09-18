import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { previewText } from '../shared/activity'
import { listAdapters } from '../shared/adapters/registry'
import { listCompatibility, lookupCompatibility } from '../shared/compatibility'
import { formatEvidenceSummary, type EvidenceDraft } from '../shared/evidence'
import { AppError, toAppError } from '../shared/errors'
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type CompatibilityLookupInput,
  type GenerateSpecInput,
  type IpcResult,
  type OllamaCheckPurpose,
  type RecordEvidenceInput,
  type SaveTextureInput
} from '../shared/ipc'
import { ACTIVITY_FLUSH_MS } from '../shared/ollamaLimits'
import { DEFAULT_PALETTE, paletteSuggestionSchema } from '../shared/pixelSpec'
import { extractJsonObject, parseProjectSpec, type ProjectSpec } from '../shared/spec'
import type { CreateProjectInput, SettingsPatch, UpdateProjectInput } from '../shared/types'
import { getStaticBuildInfo } from '../shared/buildInfo'
import { DEFAULT_OLLAMA_ENDPOINT } from '../shared/types'
import { isCodegenSupported, requiredJava } from '../shared/platformPins'
import { createTextBatcher } from './logBatcher'
import { ActivityService } from './services/activityService'
import { EvidenceService } from './services/evidenceService'
import { listProjectSnapshots, restoreProjectSnapshot } from './services/snapshotService'
import { exportBuiltJar, exportDatapackZip, exportResourcePackZip, exportSourceZip } from './services/exportService'
import { GenerationService } from './services/generationService'
import { GradleService } from './services/gradleService'
import { checkJava } from './services/javaService'
import { OllamaService } from './services/ollamaService'
import { listProjectTree, readProjectFile, writeProjectFile } from './services/projectFiles'
import { ProjectService } from './services/projectService'
import { SettingsService } from './services/settingsService'
import { applyKnownTemplateRepairs } from './services/repairService'
import { loadItemTexture, loadProjectTextures, saveItemTexture, savePixelSpec } from './services/textureService'

function wrap<T>(run: () => Promise<T> | T): Promise<IpcResult<T>> {
  return Promise.resolve()
    .then(run)
    .then((data) => ({ ok: true as const, data }))
    .catch((error: unknown) => {
      const appError = toAppError(error)
      return { ok: false as const, error: appError.toPayload() }
    })
}

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

export function registerIpc(deps: {
  settings: SettingsService
  projects: ProjectService
  ollama: OllamaService
  generation: GenerationService
  gradle: GradleService
  evidence: EvidenceService
  activity: ActivityService
  openActivityWindow: () => void
}): void {
  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST, () => wrap(() => deps.projects.list()))
  ipcMain.handle(IPC_CHANNELS.PROJECTS_CREATE, (_event, input: CreateProjectInput) =>
    wrap(() => deps.projects.create(input))
  )
  ipcMain.handle(IPC_CHANNELS.PROJECTS_GET, (_event, id: string) => wrap(() => deps.projects.get(id)))
  ipcMain.handle(IPC_CHANNELS.PROJECTS_OPEN, (_event, id: string) => wrap(() => deps.projects.open(id)))
  ipcMain.handle(IPC_CHANNELS.PROJECTS_UPDATE, (_event, id: string, input: UpdateProjectInput) =>
    wrap(() => deps.projects.update(id, input))
  )
  ipcMain.handle(IPC_CHANNELS.PROJECTS_ASSESS_VERSION, (_event, id: string, toVersion: string) =>
    wrap(() => deps.projects.assessMinecraftVersion(id, toVersion))
  )
  ipcMain.handle(IPC_CHANNELS.PROJECTS_DELETE, (_event, id: string) => wrap(() => deps.projects.delete(id)))
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => wrap(() => deps.settings.get()))
  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_event, patch: SettingsPatch) =>
    wrap(() => deps.settings.update(patch))
  )
  ipcMain.handle(IPC_CHANNELS.OLLAMA_CHECK, async (_event, endpoint?: string, purpose?: OllamaCheckPurpose) =>
    wrap(async () => {
      const settings = await deps.settings.get()
      const requestId = randomUUID()
      const listing = purpose === 'list-models'
      deps.activity.record({
        channel: 'ai',
        requestId,
        title: listing ? 'Listing installed Ollama models.' : 'Checking the Ollama connection.',
        status: 'running',
        detail: 'GET /api/tags only. This does not load a model or start inference.'
      })
      const status = await deps.ollama.check(endpoint ?? settings.ollamaEndpoint, settings.ollamaTimeoutMs)
      deps.activity.record({
        channel: status.connected ? 'results' : 'errors',
        requestId,
        title: listing
          ? status.connected
            ? `Listed ${status.models.length} installed model${status.models.length === 1 ? '' : 's'}.`
            : 'Listing installed models failed.'
          : status.connected
            ? 'Ollama connection check succeeded.'
            : 'Ollama connection check failed.',
        status: status.connected ? 'success' : 'failure',
        detail: status.message,
        error: status.connected ? undefined : status.message
      })
      return status
    })
  )
  ipcMain.handle(IPC_CHANNELS.APP_ABOUT, () =>
    wrap(() => {
      const info = getStaticBuildInfo()
      return {
        version: info.version,
        buildTime: info.buildTime,
        commit: info.commit,
        executablePath: app.getPath('exe')
      }
    })
  )
  ipcMain.handle(IPC_CHANNELS.OLLAMA_CANCEL, () =>
    wrap(() => {
      deps.ollama.cancelCheck()
    })
  )
  ipcMain.handle(IPC_CHANNELS.OLLAMA_TEST, async (_event, endpoint?: string, model?: string) =>
    wrap(async () => {
      const settings = await deps.settings.get()
      const tag = (model ?? settings.ollamaModel ?? '').trim()
      if (!tag) {
        throw new AppError({
          code: 'VALIDATION',
          message: 'No model is selected for the test.',
          action: 'Choose an installed model in Settings. CraftStudio will not pick one silently.'
        })
      }
      const requestId = randomUUID()
      deps.activity.record({
        channel: 'ai',
        requestId,
        title: `Testing model ${tag}.`,
        status: 'running',
        model: tag,
        settings: {
          model: tag,
          numPredict: 8,
          numCtx: 512,
          temperature: 0,
          timeoutMs: 20000
        },
        messages: [
          { role: 'system', content: 'Reply with the single word pong.', truncated: false },
          { role: 'user', content: 'ping', truncated: false }
        ]
      })
      try {
        const result = await deps.ollama.testModel(endpoint ?? settings.ollamaEndpoint, tag)
        deps.activity.record({
          channel: 'results',
          requestId: result.requestId,
          title: `Model test finished for ${tag}.`,
          status: 'success',
          model: tag,
          settings: {
            model: tag,
            numPredict: result.settings.numPredict,
            numCtx: result.settings.numCtx,
            temperature: result.settings.temperature,
            timeoutMs: result.settings.timeoutMs
          },
          output: result.reply,
          outputTruncated: result.truncated
        })
        return result
      } catch (error) {
        deps.activity.record({
          channel: 'errors',
          requestId,
          title: `Model test failed for ${tag}.`,
          status: 'failure',
          model: tag,
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    })
  )
  ipcMain.handle(IPC_CHANNELS.OLLAMA_UNLOAD, async (_event, endpoint?: string, model?: string) =>
    wrap(async () => {
      const settings = await deps.settings.get()
      const tag = (model ?? settings.ollamaModel ?? '').trim()
      if (!tag) {
        throw new AppError({
          code: 'VALIDATION',
          message: 'No CraftStudio model is selected to unload.',
          action: 'Unload only the model this app last used. Other loaded models are left alone.'
        })
      }
      deps.activity.record({
        channel: 'ai',
        title: `Unloading ${tag}.`,
        status: 'running',
        model: tag,
        detail: 'POST /api/generate keep_alive=0 for this model only.'
      })
      const result = await deps.ollama.unload(endpoint ?? settings.ollamaEndpoint, tag)
      deps.activity.record({
        channel: 'results',
        title: `Asked Ollama to unload ${tag}.`,
        status: 'success',
        model: tag,
        detail: result.message
      })
      return result
    })
  )
  ipcMain.handle(IPC_CHANNELS.ACTIVITY_LIST, () =>
    wrap(async () => {
      const settings = await deps.settings.get()
      return deps.activity.list(settings.activityRetentionHours)
    })
  )
  ipcMain.handle(IPC_CHANNELS.ACTIVITY_CLEAR, () =>
    wrap(() => {
      deps.activity.clearView()
    })
  )
  ipcMain.handle(IPC_CHANNELS.ACTIVITY_EXPORT, (event) =>
    wrap(async () => {
      const settings = await deps.settings.get()
      const events = deps.activity.list(settings.activityRetentionHours)
      const window = senderWindow(event)
      const dialogOpts = {
        title: 'Export diagnostic activity log',
        defaultPath: 'craftstudio-activity.log',
        filters: [{ name: 'Log', extensions: ['log', 'txt'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, dialogOpts)
        : await dialog.showSaveDialog(dialogOpts)
      if (result.canceled || !result.filePath) {
        throw new AppError({
          code: 'EXPORT_FAILED',
          message: 'Activity export was cancelled.',
          action: 'Choose a destination file to save the diagnostic log.'
        })
      }
      await writeFile(result.filePath, deps.activity.exportText(), 'utf8')
      return {
        kind: 'evidence-summary' as const,
        destPath: result.filePath,
        fileCount: events.length,
        message: `Wrote ${events.length} activity event${events.length === 1 ? '' : 's'} to ${result.filePath}. Secrets are redacted. Full prompts appear only when persist-full-AI-logs was on.`
      }
    })
  )
  ipcMain.handle(IPC_CHANNELS.ACTIVITY_OPEN_WINDOW, () =>
    wrap(() => {
      deps.openActivityWindow()
    })
  )
  ipcMain.handle(IPC_CHANNELS.ADAPTERS_LIST, () =>
    wrap(async () => listAdapters(await deps.evidence.list()))
  )
  ipcMain.handle(IPC_CHANNELS.COMPATIBILITY_LOOKUP, (_event, input: CompatibilityLookupInput) =>
    wrap(async () => lookupCompatibility(input.platform, input.minecraftVersion, await deps.evidence.list()))
  )
  ipcMain.handle(IPC_CHANNELS.COMPATIBILITY_LIST, (_event, platform) =>
    wrap(async () => listCompatibility(platform, await deps.evidence.list()))
  )
  ipcMain.handle(IPC_CHANNELS.APP_DEFAULTS, () =>
    wrap(() => ({
      defaultProjectsPath: deps.settings.defaultProjectsPath(),
      homeProjectsPath: deps.settings.homeProjectsPath(),
      defaultOllamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
    }))
  )
  ipcMain.handle(IPC_CHANNELS.APP_SELECT_DIRECTORY, (event) =>
    wrap(async () => {
      const window = senderWindow(event)
      const result = window
        ? await dialog.showOpenDialog(window, {
            title: 'Choose projects folder',
            properties: ['openDirectory', 'createDirectory']
          })
        : await dialog.showOpenDialog({
            title: 'Choose projects folder',
            properties: ['openDirectory', 'createDirectory']
          })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0] ?? null
    })
  )

  ipcMain.handle(IPC_CHANNELS.SPEC_GET, (_event, projectId: string) => wrap(() => deps.generation.getSpec(projectId)))
  ipcMain.handle(IPC_CHANNELS.SPEC_GENERATE, (event, input: GenerateSpecInput) =>
    wrap(() =>
      deps.generation.generateSpec(input.projectId, input.prompt, input.mode, {
        model: input.model,
        onProgress: (progress) => {
          event.sender.send(IPC_EVENTS.GENERATION_PROGRESS, progress)
        }
      })
    )
  )
  ipcMain.handle(IPC_CHANNELS.SPEC_PREVIEW, (_event, projectId: string, spec: ProjectSpec) =>
    wrap(() => deps.generation.previewApply(projectId, spec))
  )
  ipcMain.handle(IPC_CHANNELS.SPEC_APPLY, (_event, projectId: string, spec: ProjectSpec, confirmOverwrites: boolean) =>
    wrap(() => deps.generation.applySpec(projectId, spec, confirmOverwrites))
  )
  ipcMain.handle(IPC_CHANNELS.SPEC_CANCEL, () =>
    wrap(() => {
      deps.generation.cancelGeneration()
      deps.activity.record({
        channel: 'ai',
        title: 'Cancelled the active CraftStudio inference.',
        status: 'cancelled',
        detail: 'The HTTP request was aborted. Ollama may still finish server-side if it already started generating.'
      })
    })
  )

  ipcMain.handle(IPC_CHANNELS.FILES_TREE, async (_event, projectId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      return listProjectTree(settings.projectsPath, record.directoryName)
    })
  )
  ipcMain.handle(IPC_CHANNELS.FILES_READ, async (_event, projectId: string, relativePath: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      return readProjectFile(settings.projectsPath, record.directoryName, relativePath)
    })
  )

  ipcMain.handle(IPC_CHANNELS.JAVA_CHECK, async (_event, projectId?: string) =>
    wrap(async () => {
      let required = 21
      if (projectId) {
        try {
          const record = await deps.projects.get(projectId)
          required = requiredJava(record.manifest.platform, record.manifest.minecraftVersion)
        } catch {
          required = 21
        }
      }
      return checkJava(required)
    })
  )

  ipcMain.handle(IPC_CHANNELS.BUILD_RUN, (event, projectId: string, task: 'build' | 'runClient' = 'build') =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      if (!isCodegenSupported(record.manifest.platform, record.manifest.minecraftVersion)) {
        throw new AppError({
          code: 'ADAPTER_UNSUPPORTED',
          message: `Build/Test is not implemented for ${record.manifest.platform} ${record.manifest.minecraftVersion}.`,
          action: 'Use a supported Fabric, Paper, NeoForge, Forge 1.21.1, or Spigot 1.21.x project. This button will not fake success.'
        })
      }
      if (task === 'runClient') {
        if (
          record.manifest.platform !== 'fabric' &&
          record.manifest.platform !== 'neoforge' &&
          record.manifest.platform !== 'forge'
        ) {
          throw new AppError({
            code: 'ADAPTER_UNSUPPORTED',
            message: 'runClient is a Fabric Loom, NeoForge ModDev, or ForgeGradle task only.',
            action: 'Paper and Spigot projects get test-server prep notes, not a launched server.'
          })
        }
        const settings = await deps.settings.get()
        if (!settings.minecraftEulaAccepted) {
          throw new AppError({
            code: 'TERMS_REQUIRED',
            message: 'Minecraft EULA / runtime terms were not accepted.',
            action: 'Read the Minecraft EULA, then accept it explicitly in Settings or on the Test tab. CraftStudio never silent-accepts.'
          })
        }
      }
      const buildId = randomUUID()
      const args = task === 'runClient' ? ['runClient', '--no-daemon', '--stacktrace'] : ['build', '--no-daemon', '--stacktrace']
      deps.activity.record({
        channel: 'build',
        buildId,
        title: task === 'build' ? 'Running the Gradle build.' : 'Running Gradle runClient.',
        status: 'running',
        command: process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
        args: [...args],
        cwd: record.directoryPath,
        detail: 'Allowlisted Gradle task only. Logging does not enable arbitrary command execution.'
      })
      const stdout = createTextBatcher((text) => event.sender.send(IPC_EVENTS.BUILD_LOG, { stream: 'stdout', text }), ACTIVITY_FLUSH_MS)
      const stderr = createTextBatcher((text) => event.sender.send(IPC_EVENTS.BUILD_LOG, { stream: 'stderr', text }), ACTIVITY_FLUSH_MS)
      try {
        const result = await deps.gradle.run(record.directoryPath, task, {
          onLog: (chunk) => {
            if (chunk.stream === 'stderr') {
              stderr.push(chunk.text)
            } else {
              stdout.push(chunk.text)
            }
          }
        })
        stdout.dispose()
        stderr.dispose()
        deps.activity.record({
          channel: result.exitCode === 0 ? 'results' : result.cancelled ? 'build' : 'errors',
          buildId,
          title: result.cancelled
            ? 'Gradle task was cancelled.'
            : result.exitCode === 0
              ? task === 'build'
                ? 'Gradle build finished.'
                : 'Gradle runClient finished.'
              : 'Gradle task failed.',
          status: result.cancelled ? 'cancelled' : result.exitCode === 0 ? 'success' : 'failure',
          command: result.command,
          args: [...args],
          cwd: record.directoryPath,
          exitCode: result.exitCode,
          cancelled: result.cancelled,
          output: previewText(result.logs, 500, false).content,
          outputTruncated: result.logs.length > 500,
          detail: result.message
        })
        return result
      } catch (error) {
        stdout.dispose()
        stderr.dispose()
        deps.activity.record({
          channel: 'errors',
          buildId,
          title: 'Gradle task did not start.',
          status: 'failure',
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    })
  )

  ipcMain.handle(IPC_CHANNELS.EXPORT_SOURCE, (event, projectId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      const window = senderWindow(event)
      const dialogOpts = {
        title: 'Export source ZIP',
        defaultPath: `${record.manifest.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}-source.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, dialogOpts)
        : await dialog.showSaveDialog(dialogOpts)
      if (result.canceled || !result.filePath) {
        throw new AppError({
          code: 'EXPORT_FAILED',
          message: 'Source export was cancelled.',
          action: 'Choose a .zip destination to export the project sources.'
        })
      }
      return exportSourceZip(settings.projectsPath, record.directoryName, result.filePath)
    })
  )

  ipcMain.handle(IPC_CHANNELS.EXPORT_JAR, (event, projectId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      const window = senderWindow(event)
      const dialogOpts = {
        title: 'Export built JAR',
        defaultPath: `${record.manifest.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}.jar`,
        filters: [{ name: 'JAR', extensions: ['jar'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, dialogOpts)
        : await dialog.showSaveDialog(dialogOpts)
      if (result.canceled || !result.filePath) {
        throw new AppError({
          code: 'EXPORT_FAILED',
          message: 'JAR export was cancelled.',
          action: 'Build the project first, then choose a .jar destination.'
        })
      }
      return exportBuiltJar(settings.projectsPath, record.directoryName, record.manifest.platform, result.filePath)
    })
  )
  ipcMain.handle(IPC_CHANNELS.BUILD_CANCEL, () =>
    wrap(() => {
      deps.gradle.cancel()
    })
  )
  ipcMain.handle(IPC_CHANNELS.BUILD_REPAIR, (_event, projectId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      const last = deps.gradle.lastResult(record.directoryPath)
      return applyKnownTemplateRepairs(
        settings.projectsPath,
        record.directoryName,
        last?.logs ?? '',
        last?.started ?? false
      )
    })
  )

  ipcMain.handle(IPC_CHANNELS.FILES_WRITE, async (_event, projectId: string, relativePath: string, contents: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      const written = await writeProjectFile(settings.projectsPath, record.directoryName, relativePath, contents)
      deps.activity.record({
        channel: 'files',
        title: `Updating ${relativePath}.`,
        path: relativePath,
        status: 'success'
      })
      return written
    })
  )

  ipcMain.handle(IPC_CHANNELS.TEXTURE_GET, async (_event, projectId: string, itemId: string, layer?: 'layer0' | 'layer1') =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      return loadItemTexture(settings.projectsPath, record.directoryName, itemId, layer ?? 'layer0')
    })
  )

  ipcMain.handle(IPC_CHANNELS.TEXTURE_SAVE, async (_event, input: SaveTextureInput) =>
    wrap(async () => {
      const record = await deps.projects.get(input.projectId)
      const settings = await deps.settings.get()
      const saved = await saveItemTexture(
        settings.projectsPath,
        record.directoryName,
        input.itemId,
        input.width,
        input.height,
        Uint8Array.from(input.pixels),
        input.layer ?? 'layer0'
      )
      if (input.pixelSpec) {
        await savePixelSpec(
          settings.projectsPath,
          record.directoryName,
          input.itemId,
          input.pixelSpec,
          input.layer ?? 'layer0'
        )
      }
      deps.activity.record({
        channel: 'files',
        title: 'Writing item assets.',
        path: saved.relativePath,
        status: 'success'
      })
      return saved
    })
  )

  ipcMain.handle(IPC_CHANNELS.TEXTURE_PALETTE, async (_event, projectId: string, prompt?: string) =>
    wrap(async () => {
      await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      const fallback = {
        palette: [...DEFAULT_PALETTE],
        usedOllama: false,
        note: 'Default CraftStudio palette. Ollama was not used to draw pixels.'
      }
      if (!settings.ollamaModel) {
        return fallback
      }
      try {
        const raw = await deps.ollama.chatJson({
          endpoint: settings.ollamaEndpoint,
          model: settings.ollamaModel,
          timeoutMs: Math.min(settings.ollamaGenerateTimeoutMs, 30000),
          numPredict: 256,
          numCtx: 1024,
          format: 'json',
          messages: [
            {
              role: 'system',
              content:
                'Return ONLY JSON {"palette":["#RRGGBB",...]} with 4-12 hex colors. Do not describe an image. Do not claim you drew pixels.'
            },
            {
              role: 'user',
              content: prompt?.trim() || 'Suggest a muted item-texture palette for a Minecraft custom item.'
            }
          ]
        })
        const parsed = paletteSuggestionSchema.parse(extractJsonObject(raw))
        return {
          palette: parsed.palette,
          usedOllama: true,
          note: 'Ollama suggested hex colors only. It did not generate a raster texture.'
        }
      } catch {
        return fallback
      }
    })
  )

  ipcMain.handle(IPC_CHANNELS.EXPORT_PACK, (event, projectId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const spec = await deps.generation.getSpec(projectId)
      if (!spec) {
        throw new AppError({
          code: 'EXPORT_FAILED',
          message: 'No validated spec on disk. Generate and apply items first.',
          action: 'Open Design, apply a spec, paint textures on Assets, then export the pack.'
        })
      }
      parseProjectSpec(spec)
      const settings = await deps.settings.get()
      const textures = await loadProjectTextures(
        settings.projectsPath,
        record.directoryName,
        [...spec.items.map((item) => item.id), ...spec.blocks.map((block) => block.id)]
      )
      const window = senderWindow(event)
      const dialogOpts = {
        title: 'Export resource pack',
        defaultPath: `${record.manifest.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}-resource-pack.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, dialogOpts)
        : await dialog.showSaveDialog(dialogOpts)
      if (result.canceled || !result.filePath) {
        throw new AppError({
          code: 'EXPORT_FAILED',
          message: 'Resource-pack export was cancelled.',
          action: 'Choose a .zip destination for the pack.'
        })
      }
      return exportResourcePackZip(
        settings.projectsPath,
        record.directoryName,
        record.manifest,
        spec,
        textures,
        result.filePath
      )
    })
  )

  ipcMain.handle(IPC_CHANNELS.EXPORT_DATAPACK, (event, projectId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const spec = await deps.generation.getSpec(projectId)
      if (!spec) {
        throw new AppError({
          code: 'EXPORT_FAILED',
          message: 'No validated spec on disk. Generate and apply first.',
          action: 'Open Design, apply a spec with loot or worldgen, then export the datapack.'
        })
      }
      parseProjectSpec(spec)
      const settings = await deps.settings.get()
      const window = senderWindow(event)
      const dialogOpts = {
        title: 'Export datapack ZIP',
        defaultPath: `${record.manifest.name.replace(/[^a-zA-Z0-9_-]+/g, '-')}-datapack.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, dialogOpts)
        : await dialog.showSaveDialog(dialogOpts)
      if (result.canceled || !result.filePath) {
        throw new AppError({
          code: 'EXPORT_FAILED',
          message: 'Datapack export was cancelled.',
          action: 'Choose a .zip destination for the datapack.'
        })
      }
      return exportDatapackZip(
        settings.projectsPath,
        record.directoryName,
        spec,
        record.manifest.minecraftVersion,
        result.filePath
      )
    })
  )

  ipcMain.handle(IPC_CHANNELS.EXPORT_EVIDENCE, (event) =>
    wrap(async () => {
      const records = await deps.evidence.list()
      const window = senderWindow(event)
      const dialogOpts = {
        title: 'Export evidence summary',
        defaultPath: 'craftstudio-evidence-summary.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, dialogOpts)
        : await dialog.showSaveDialog(dialogOpts)
      if (result.canceled || !result.filePath) {
        throw new AppError({
          code: 'EXPORT_FAILED',
          message: 'Evidence export was cancelled.',
          action: 'Choose a .md destination for the summary.'
        })
      }
      const contents = formatEvidenceSummary(records, {
        appVersion: getStaticBuildInfo().version,
        generatedAt: new Date().toISOString()
      })
      await writeFile(result.filePath, contents, 'utf8')
      return {
        kind: 'evidence-summary' as const,
        destPath: result.filePath,
        fileCount: 1,
        message: `Wrote evidence summary (${records.length} record${records.length === 1 ? '' : 's'}) to ${result.filePath}.`
      }
    })
  )

  ipcMain.handle(IPC_CHANNELS.SNAPSHOTS_LIST, async (_event, projectId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      return listProjectSnapshots(settings.projectsPath, record.directoryName)
    })
  )
  ipcMain.handle(IPC_CHANNELS.SNAPSHOTS_RESTORE, async (_event, projectId: string, snapshotId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      return restoreProjectSnapshot(settings.projectsPath, record.directoryName, snapshotId)
    })
  )

  ipcMain.handle(IPC_CHANNELS.EVIDENCE_LIST, () => wrap(() => deps.evidence.list()))
  ipcMain.handle(IPC_CHANNELS.EVIDENCE_RECORD, (_event, input: RecordEvidenceInput) =>
    wrap(async () => {
      const record = await deps.projects.get(input.projectId)
      const settings = await deps.settings.get()
      const last = deps.gradle.lastResult(record.directoryPath)
      const draft: EvidenceDraft = {
        platform: record.manifest.platform,
        minecraftVersion: record.manifest.minecraftVersion,
        projectId: record.manifest.id,
        verifiedWhat: input.verifiedWhat,
        notes: input.notes,
        eulaAccepted: Boolean(settings.minecraftEulaAccepted),
        compileOnly: last?.compileOnly === true && last.task === 'build',
        runtimeExitCode: last?.exitCode ?? null,
        userAttestedLaunch: input.userAttestedLaunch
      }
      if (input.verifiedWhat === 'paper_user_server' || input.verifiedWhat === 'spigot_user_server') {
        draft.compileOnly = false
      }
      return deps.evidence.record(
        draft,
        last
          ? {
              task: last.task,
              exitCode: last.exitCode,
              compileOnly: last.compileOnly,
              cancelled: last.cancelled,
              timedOut: last.timedOut
            }
          : undefined
      )
    })
  )
}
