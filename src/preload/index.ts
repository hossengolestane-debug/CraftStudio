import { contextBridge, ipcRenderer } from 'electron'
import { AppError, isAppErrorPayload } from '../shared/errors'
import type { ActivityEvent } from '../shared/activity'
import {
  IPC_CHANNELS,
  IPC_EVENTS,
  type AppDefaults,
  type BuildLogEvent,
  type CompatibilityLookupInput,
  type CraftStudioAPI,
  type GenerateSpecInput,
  type GenerationProgress,
  type IpcResult
} from '../shared/ipc'
import type { ProjectSpec } from '../shared/spec'
import type { RecordEvidenceInput, SaveTextureInput } from '../shared/ipc'
import type { CreateProjectInput, PlatformId, SettingsPatch, UpdateProjectInput } from '../shared/types'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (result && typeof result === 'object' && 'ok' in result) {
    if (result.ok) {
      return result.data
    }
    throw new AppError(result.error)
  }
  throw new AppError({
    code: 'UNKNOWN',
    message: 'The desktop bridge returned an unexpected response.',
    action: 'Restart the app. If this continues, file a bug with the technical details.',
    details: isAppErrorPayload(result) ? JSON.stringify(result) : JSON.stringify(result)
  })
}

const api: CraftStudioAPI = {
  listProjects: () => invoke(IPC_CHANNELS.PROJECTS_LIST),
  createProject: (input: CreateProjectInput) => invoke(IPC_CHANNELS.PROJECTS_CREATE, input),
  getProject: (id: string) => invoke(IPC_CHANNELS.PROJECTS_GET, id),
  openProject: (id: string) => invoke(IPC_CHANNELS.PROJECTS_OPEN, id),
  updateProject: (id: string, input: UpdateProjectInput) => invoke(IPC_CHANNELS.PROJECTS_UPDATE, id, input),
  deleteProject: (id: string) => invoke(IPC_CHANNELS.PROJECTS_DELETE, id),
  getSettings: () => invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (patch: SettingsPatch) => invoke(IPC_CHANNELS.SETTINGS_UPDATE, patch),
  checkOllama: (endpoint?: string) => invoke(IPC_CHANNELS.OLLAMA_CHECK, endpoint),
  cancelOllamaCheck: () => invoke(IPC_CHANNELS.OLLAMA_CANCEL),
  testOllamaModel: (endpoint?: string, model?: string) => invoke(IPC_CHANNELS.OLLAMA_TEST, endpoint, model),
  unloadOllamaModel: (endpoint?: string, model?: string) => invoke(IPC_CHANNELS.OLLAMA_UNLOAD, endpoint, model),
  cancelOllamaInference: () => invoke(IPC_CHANNELS.SPEC_CANCEL),
  listActivity: () => invoke(IPC_CHANNELS.ACTIVITY_LIST),
  clearActivity: () => invoke(IPC_CHANNELS.ACTIVITY_CLEAR),
  exportActivity: () => invoke(IPC_CHANNELS.ACTIVITY_EXPORT),
  openActivityWindow: () => invoke(IPC_CHANNELS.ACTIVITY_OPEN_WINDOW),
  listAdapters: () => invoke(IPC_CHANNELS.ADAPTERS_LIST),
  lookupCompatibility: (input: CompatibilityLookupInput) => invoke(IPC_CHANNELS.COMPATIBILITY_LOOKUP, input),
  listCompatibility: (platform: PlatformId) => invoke(IPC_CHANNELS.COMPATIBILITY_LIST, platform),
  getAppDefaults: () => invoke<AppDefaults>(IPC_CHANNELS.APP_DEFAULTS),
  selectDirectory: () => invoke(IPC_CHANNELS.APP_SELECT_DIRECTORY),
  getSpec: (projectId: string) => invoke(IPC_CHANNELS.SPEC_GET, projectId),
  generateSpec: (input: GenerateSpecInput) => invoke(IPC_CHANNELS.SPEC_GENERATE, input),
  previewApply: (projectId: string, spec: ProjectSpec) => invoke(IPC_CHANNELS.SPEC_PREVIEW, projectId, spec),
  applySpec: (projectId: string, spec: ProjectSpec, confirmOverwrites: boolean) =>
    invoke(IPC_CHANNELS.SPEC_APPLY, projectId, spec, confirmOverwrites),
  cancelGeneration: () => invoke(IPC_CHANNELS.SPEC_CANCEL),
  listProjectFiles: (projectId: string) => invoke(IPC_CHANNELS.FILES_TREE, projectId),
  readProjectFile: (projectId: string, relativePath: string) => invoke(IPC_CHANNELS.FILES_READ, projectId, relativePath),
  writeProjectFile: (projectId: string, relativePath: string, contents: string) =>
    invoke(IPC_CHANNELS.FILES_WRITE, projectId, relativePath, contents),
  checkJava: (projectId?: string) => invoke(IPC_CHANNELS.JAVA_CHECK, projectId),
  runBuild: (projectId: string, task?: 'build' | 'runClient') => invoke(IPC_CHANNELS.BUILD_RUN, projectId, task ?? 'build'),
  cancelBuild: () => invoke(IPC_CHANNELS.BUILD_CANCEL),
  repairBuild: (projectId: string) => invoke(IPC_CHANNELS.BUILD_REPAIR, projectId),
  exportSourceZip: (projectId: string) => invoke(IPC_CHANNELS.EXPORT_SOURCE, projectId),
  exportBuiltJar: (projectId: string) => invoke(IPC_CHANNELS.EXPORT_JAR, projectId),
  exportResourcePack: (projectId: string) => invoke(IPC_CHANNELS.EXPORT_PACK, projectId),
  exportDatapack: (projectId: string) => invoke(IPC_CHANNELS.EXPORT_DATAPACK, projectId),
  exportEvidenceSummary: () => invoke(IPC_CHANNELS.EXPORT_EVIDENCE),
  getTexture: (projectId: string, itemId: string, layer?) => invoke(IPC_CHANNELS.TEXTURE_GET, projectId, itemId, layer),
  saveTexture: (input: SaveTextureInput) => invoke(IPC_CHANNELS.TEXTURE_SAVE, input),
  suggestTexturePalette: (projectId: string, prompt?: string) => invoke(IPC_CHANNELS.TEXTURE_PALETTE, projectId, prompt),
  listEvidence: () => invoke(IPC_CHANNELS.EVIDENCE_LIST),
  recordEvidence: (input: RecordEvidenceInput) => invoke(IPC_CHANNELS.EVIDENCE_RECORD, input),
  listSnapshots: (projectId: string) => invoke(IPC_CHANNELS.SNAPSHOTS_LIST, projectId),
  restoreSnapshot: (projectId: string, snapshotId: string) =>
    invoke(IPC_CHANNELS.SNAPSHOTS_RESTORE, projectId, snapshotId),
  assessVersionChange: (projectId: string, toVersion: string) =>
    invoke(IPC_CHANNELS.PROJECTS_ASSESS_VERSION, projectId, toVersion),
  onGenerationProgress: (handler: (event: GenerationProgress) => void) => {
    const listener = (_event: unknown, payload: GenerationProgress): void => handler(payload)
    ipcRenderer.on(IPC_EVENTS.GENERATION_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IPC_EVENTS.GENERATION_PROGRESS, listener)
  },
  onBuildLog: (handler: (event: BuildLogEvent) => void) => {
    const listener = (_event: unknown, payload: BuildLogEvent): void => handler(payload)
    ipcRenderer.on(IPC_EVENTS.BUILD_LOG, listener)
    return () => ipcRenderer.removeListener(IPC_EVENTS.BUILD_LOG, listener)
  },
  onActivity: (handler: (event: ActivityEvent) => void) => {
    const listener = (_event: unknown, payload: ActivityEvent): void => handler(payload)
    ipcRenderer.on(IPC_EVENTS.ACTIVITY, listener)
    return () => ipcRenderer.removeListener(IPC_EVENTS.ACTIVITY, listener)
  }
}

contextBridge.exposeInMainWorld('craftstudio', api)
