import type { AppErrorPayload } from './errors'
import type { ProjectSpec } from './spec'
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
  APP_SELECT_DIRECTORY: 'app:select-directory',
  SPEC_GET: 'spec:get',
  SPEC_GENERATE: 'spec:generate',
  SPEC_PREVIEW: 'spec:preview',
  SPEC_APPLY: 'spec:apply',
  SPEC_CANCEL: 'spec:cancel',
  FILES_TREE: 'files:tree',
  FILES_READ: 'files:read',
  JAVA_CHECK: 'java:check',
  BUILD_RUN: 'build:run',
  BUILD_CANCEL: 'build:cancel'
} as const

export const IPC_EVENTS = {
  GENERATION_PROGRESS: 'generation:progress',
  BUILD_LOG: 'build:log'
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

export type GenerationMode = 'auto' | 'template' | 'ollama'

export interface GenerateSpecInput {
  projectId: string
  prompt: string
  mode: GenerationMode
  model?: string
}

export interface GenerationProgress {
  stage: 'infer' | 'ollama' | 'repair' | 'validate' | 'plan' | 'done'
  message: string
}

export interface FileChangeDto {
  relativePath: string
  action: 'create' | 'overwrite' | 'unchanged'
  previous?: string
  nextPreview?: string
  summary: string
  buildScript: boolean
}

export interface GenerationResultDto {
  spec: ProjectSpec
  usedOllama: boolean
  repairAttempts: number
  remainingProblems: string[]
  ollamaNote: string | null
  success: true
}

export interface ApplyPreviewDto {
  spec: ProjectSpec
  changes: FileChangeDto[]
  overwriteCount: number
  buildScriptChanges: string[]
}

export interface ApplyResultDto extends ApplyPreviewDto {
  applied: boolean
}

export interface ProjectFileNodeDto {
  name: string
  relativePath: string
  type: 'file' | 'directory'
  children?: ProjectFileNodeDto[]
}

export interface ProjectFileContentsDto {
  relativePath: string
  contents: string
  truncated: boolean
}

export interface JavaStatusDto {
  available: boolean
  version: number | null
  raw: string
  meets: boolean
  required: number
  message: string
}

export interface BuildResultDto {
  started: boolean
  exitCode: number | null
  timedOut: boolean
  cancelled: boolean
  command: string
  logs: string
  message: string
}

export interface BuildLogEvent {
  stream: 'stdout' | 'stderr'
  text: string
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
  getSpec: (projectId: string) => Promise<ProjectSpec | null>
  generateSpec: (input: GenerateSpecInput) => Promise<GenerationResultDto>
  previewApply: (projectId: string, spec: ProjectSpec) => Promise<ApplyPreviewDto>
  applySpec: (projectId: string, spec: ProjectSpec, confirmOverwrites: boolean) => Promise<ApplyResultDto>
  cancelGeneration: () => Promise<void>
  listProjectFiles: (projectId: string) => Promise<ProjectFileNodeDto[]>
  readProjectFile: (projectId: string, relativePath: string) => Promise<ProjectFileContentsDto>
  checkJava: (projectId: string) => Promise<JavaStatusDto>
  runBuild: (projectId: string) => Promise<BuildResultDto>
  cancelBuild: () => Promise<void>
  onGenerationProgress: (handler: (event: GenerationProgress) => void) => () => void
  onBuildLog: (handler: (event: BuildLogEvent) => void) => () => void
}
