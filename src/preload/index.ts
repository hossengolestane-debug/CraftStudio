import { contextBridge, ipcRenderer } from 'electron'
import { AppError, isAppErrorPayload } from '../shared/errors'
import {
  IPC_CHANNELS,
  type AppDefaults,
  type CompatibilityLookupInput,
  type CraftStudioAPI,
  type IpcResult
} from '../shared/ipc'
import type {
  CreateProjectInput,
  PlatformId,
  SettingsPatch,
  UpdateProjectInput
} from '../shared/types'

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
  listAdapters: () => invoke(IPC_CHANNELS.ADAPTERS_LIST),
  lookupCompatibility: (input: CompatibilityLookupInput) => invoke(IPC_CHANNELS.COMPATIBILITY_LOOKUP, input),
  listCompatibility: (platform: PlatformId) => invoke(IPC_CHANNELS.COMPATIBILITY_LIST, platform),
  getAppDefaults: () => invoke<AppDefaults>(IPC_CHANNELS.APP_DEFAULTS),
  selectDirectory: () => invoke(IPC_CHANNELS.APP_SELECT_DIRECTORY)
}

contextBridge.exposeInMainWorld('craftstudio', api)
