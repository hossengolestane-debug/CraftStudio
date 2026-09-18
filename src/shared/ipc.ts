import type { AppErrorPayload } from './errors'
import type {
  AppSettings,
  CompatibilityEntry,
  CreateProjectInput,
  OllamaStatus,
  PlatformAdapterInfo,
  PlatformId,
  ProjectRecord,
  ProjectSummary,
  SettingsPatch,
  UpdateProjectInput
} from './types'

export const IPC_CHANNELS = {
  PROJECTS_LIST: 'projects:list',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_GET: 'projects:get',
  PROJECTS_OPEN: 'projects:open',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DELETE: 'projects:delete',
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  OLLAMA_CHECK: 'ollama:check',
  OLLAMA_CANCEL: 'ollama:cancel',
  ADAPTERS_LIST: 'adapters:list',
  COMPATIBILITY_LOOKUP: 'compatibility:lookup',
  COMPATIBILITY_LIST: 'compatibility:list',
  APP_DEFAULTS: 'app:defaults',
  APP_SELECT_DIRECTORY: 'app:select-directory'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: AppErrorPayload }

export interface CompatibilityLookupInput {
  platform: PlatformId
  minecraftVersion: string
}

export interface AppDefaults {
  defaultProjectsPath: string
  homeProjectsPath: string
  defaultOllamaEndpoint: string
}

export interface CraftStudioAPI {
  listProjects: () => Promise<ProjectSummary[]>
  createProject: (input: CreateProjectInput) => Promise<ProjectRecord>
  getProject: (id: string) => Promise<ProjectRecord>
  openProject: (id: string) => Promise<ProjectRecord>
  updateProject: (id: string, input: UpdateProjectInput) => Promise<ProjectRecord>
  deleteProject: (id: string) => Promise<void>
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: SettingsPatch) => Promise<AppSettings>
  checkOllama: (endpoint?: string) => Promise<OllamaStatus>
  cancelOllamaCheck: () => Promise<void>
  listAdapters: () => Promise<PlatformAdapterInfo[]>
  lookupCompatibility: (input: CompatibilityLookupInput) => Promise<CompatibilityEntry>
  listCompatibility: (platform: PlatformId) => Promise<CompatibilityEntry[]>
  getAppDefaults: () => Promise<AppDefaults>
  selectDirectory: () => Promise<string | null>
}

export interface GenerateStubResult {
  available: false
  phase: 'Phase 2'
  message: string
}
