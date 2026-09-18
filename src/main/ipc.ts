import { BrowserWindow, dialog, ipcMain } from 'electron'
import { listAdapters } from '../shared/adapters/registry'
import { listCompatibility, lookupCompatibility } from '../shared/compatibility'
import type { EvidenceDraft } from '../shared/evidence'
import { AppError, toAppError } from '../shared/errors'
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type CompatibilityLookupInput,
  type GenerateSpecInput,
  type IpcResult,
  type RecordEvidenceInput,
  type SaveTextureInput
} from '../shared/ipc'
import { DEFAULT_PALETTE, paletteSuggestionSchema } from '../shared/pixelSpec'
import { extractJsonObject, parseProjectSpec, type ProjectSpec } from '../shared/spec'
import type { CreateProjectInput, SettingsPatch, UpdateProjectInput } from '../shared/types'
import { DEFAULT_OLLAMA_ENDPOINT } from '../shared/types'
import { isCodegenSupported, requiredJava } from '../shared/platformPins'
import { EvidenceService } from './services/evidenceService'
import { listProjectSnapshots, restoreProjectSnapshot } from './services/snapshotService'
import { exportBuiltJar, exportResourcePackZip, exportSourceZip } from './services/exportService'
import { GenerationService } from './services/generationService'
import { GradleService } from './services/gradleService'
import { checkJava } from './services/javaService'
import { OllamaService } from './services/ollamaService'
import { listProjectTree, readProjectFile, writeProjectFile } from './services/projectFiles'
import { ProjectService } from './services/projectService'
import { SettingsService } from './services/settingsService'
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
  ipcMain.handle(IPC_CHANNELS.OLLAMA_CHECK, async (_event, endpoint?: string) =>
    wrap(async () => {
      const settings = await deps.settings.get()
      return deps.ollama.check(endpoint ?? settings.ollamaEndpoint, settings.ollamaTimeoutMs)
    })
  )
  ipcMain.handle(IPC_CHANNELS.OLLAMA_CANCEL, () =>
    wrap(() => {
      deps.ollama.cancel()
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
      deps.ollama.cancel()
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

  ipcMain.handle(IPC_CHANNELS.JAVA_CHECK, async (_event, projectId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      let required = 21
      try {
        required = requiredJava(record.manifest.platform, record.manifest.minecraftVersion)
      } catch {
        required = 21
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
      return deps.gradle.run(record.directoryPath, task, {
        onLog: (chunk) => event.sender.send(IPC_EVENTS.BUILD_LOG, chunk)
      })
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

  ipcMain.handle(IPC_CHANNELS.FILES_WRITE, async (_event, projectId: string, relativePath: string, contents: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      return writeProjectFile(settings.projectsPath, record.directoryName, relativePath, contents)
    })
  )

  ipcMain.handle(IPC_CHANNELS.TEXTURE_GET, async (_event, projectId: string, itemId: string) =>
    wrap(async () => {
      const record = await deps.projects.get(projectId)
      const settings = await deps.settings.get()
      return loadItemTexture(settings.projectsPath, record.directoryName, itemId)
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
        Uint8Array.from(input.pixels)
      )
      if (input.pixelSpec) {
        await savePixelSpec(settings.projectsPath, record.directoryName, input.itemId, input.pixelSpec)
      }
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
        spec.items.map((item) => item.id)
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
