import type { ActivityEvent } from './activity'
import type { BuildDiagnostic } from './buildDiagnostics'
import type { RuntimeEvidenceRecord, VerifiedWhat } from './evidence'
import type { MigrationAssessment } from './migration'
import type { AppErrorPayload } from './errors'
import type { PixelSpec } from './pixelSpec'
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
  OLLAMA_TEST: 'ollama:test',
  OLLAMA_UNLOAD: 'ollama:unload',
  ACTIVITY_LIST: 'activity:list',
  ACTIVITY_CLEAR: 'activity:clear',
  ACTIVITY_EXPORT: 'activity:export',
  ACTIVITY_OPEN_WINDOW: 'activity:open-window',
  APP_ABOUT: 'app:about',
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
  BUILD_CANCEL: 'build:cancel',
  BUILD_REPAIR: 'build:repair',
  EXPORT_SOURCE: 'export:source',
  EXPORT_JAR: 'export:jar',
  EXPORT_PACK: 'export:pack',
  EXPORT_DATAPACK: 'export:datapack',
  EXPORT_EVIDENCE: 'export:evidence',
  FILES_WRITE: 'files:write',
  TEXTURE_GET: 'texture:get',
  TEXTURE_SAVE: 'texture:save',
  TEXTURE_PALETTE: 'texture:palette',
  EVIDENCE_LIST: 'evidence:list',
  EVIDENCE_RECORD: 'evidence:record',
  SNAPSHOTS_LIST: 'snapshots:list',
  SNAPSHOTS_RESTORE: 'snapshots:restore',
  PROJECTS_ASSESS_VERSION: 'projects:assess-version'
} as const

export const IPC_EVENTS = {
  GENERATION_PROGRESS: 'generation:progress',
  BUILD_LOG: 'build:log',
  ACTIVITY: 'activity:event'
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
  requestId: string
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
  task?: 'build' | 'runClient'
  logs: string
  message: string
  compileOnly?: boolean
  diagnostics?: BuildDiagnostic[]
}

export interface RepairResultDto {
  attempted: boolean
  applied: string[]
  remaining: string[]
  filesChanged: string[]
  message: string
}

export interface ExportResultDto {
  kind: 'source-zip' | 'jar' | 'resource-pack' | 'datapack' | 'evidence-summary'
  destPath: string
  fileCount: number
  message: string
}

export type TextureLayer = 'layer0' | 'layer1'

export interface TextureDto {
  itemId: string
  layer?: TextureLayer
  relativePath: string
  width: number
  height: number
  pixels: number[]
}

export interface SaveTextureInput {
  projectId: string
  itemId: string
  width: number
  height: number
  pixels: number[]
  pixelSpec?: PixelSpec
  layer?: TextureLayer
}

export interface PaletteSuggestionDto {
  palette: string[]
  usedOllama: boolean
  note: string
}

export interface SnapshotRecordDto {
  id: string
  reason: 'before-apply' | 'before-version-change'
  createdAt: string
  platform: string
  minecraftVersion: string
  fileCount: number
  relativePath: string
}

export type MigrationAssessmentDto = MigrationAssessment

export interface RecordEvidenceInput {
  projectId: string
  verifiedWhat: VerifiedWhat
  notes: string
  userAttestedLaunch?: boolean
}

export interface RunBuildInput {
  projectId: string
  task?: 'build' | 'runClient'
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
  checkOllama: (endpoint?: string, purpose?: OllamaCheckPurpose) => Promise<OllamaStatus>
  getAbout: () => Promise<AppAboutDto>
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
  writeProjectFile: (projectId: string, relativePath: string, contents: string) => Promise<{ relativePath: string; bytes: number }>
  checkJava: (projectId?: string) => Promise<JavaStatusDto>
  runBuild: (projectId: string, task?: 'build' | 'runClient') => Promise<BuildResultDto>
  cancelBuild: () => Promise<void>
  repairBuild: (projectId: string) => Promise<RepairResultDto>
  exportSourceZip: (projectId: string) => Promise<ExportResultDto>
  exportBuiltJar: (projectId: string) => Promise<ExportResultDto>
  exportResourcePack: (projectId: string) => Promise<ExportResultDto>
  exportDatapack: (projectId: string) => Promise<ExportResultDto>
  exportEvidenceSummary: () => Promise<ExportResultDto>
  getTexture: (projectId: string, itemId: string, layer?: TextureLayer) => Promise<TextureDto | null>
  saveTexture: (input: SaveTextureInput) => Promise<TextureDto>
  suggestTexturePalette: (projectId: string, prompt?: string) => Promise<PaletteSuggestionDto>
  listEvidence: () => Promise<RuntimeEvidenceRecord[]>
  recordEvidence: (input: RecordEvidenceInput) => Promise<RuntimeEvidenceRecord>
  listSnapshots: (projectId: string) => Promise<SnapshotRecordDto[]>
  restoreSnapshot: (projectId: string, snapshotId: string) => Promise<SnapshotRecordDto>
  assessVersionChange: (projectId: string, toVersion: string) => Promise<MigrationAssessmentDto>
  testOllamaModel: (endpoint?: string, model?: string) => Promise<ModelTestResultDto>
  unloadOllamaModel: (endpoint?: string, model?: string) => Promise<OllamaUnloadResultDto>
  cancelOllamaInference: () => Promise<void>
  listActivity: () => Promise<ActivityEvent[]>
  clearActivity: () => Promise<void>
  exportActivity: () => Promise<ExportResultDto>
  openActivityWindow: () => Promise<void>
  onGenerationProgress: (handler: (event: GenerationProgress) => void) => () => void
  onBuildLog: (handler: (event: BuildLogEvent) => void) => () => void
  onActivity: (handler: (event: ActivityEvent) => void) => () => void
}

export interface ModelTestResultDto {
  requestId: string
  model: string
  reply: string
  settings: { numPredict: number; numCtx: number; timeoutMs: number; temperature: number }
  truncated: boolean
}

export interface OllamaUnloadResultDto {
  model: string
  message: string
}

export type OllamaCheckPurpose = 'connection' | 'list-models'

export interface AppAboutDto {
  version: string
  buildTime: string
  commit: string
  executablePath: string
}
