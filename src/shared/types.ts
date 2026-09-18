export const PROJECT_KINDS = ['mod', 'plugin'] as const
export type ProjectKind = (typeof PROJECT_KINDS)[number]

export const PLATFORM_IDS = ['fabric', 'neoforge', 'forge', 'paper', 'spigot'] as const
export type PlatformId = (typeof PLATFORM_IDS)[number]

export const COMPATIBILITY_STATUSES = ['tested', 'experimental', 'unsupported'] as const
export type CompatibilityStatus = (typeof COMPATIBILITY_STATUSES)[number]

export const MANIFEST_SCHEMA_VERSION = 1
export const SETTINGS_SCHEMA_VERSION = 3
export const MANIFEST_FILENAME = 'craftstudio.project.json'
export const SPEC_FILENAME = 'craftstudio.spec.json'
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434'
export const DEFAULT_OLLAMA_TIMEOUT_MS = 8000
export const DEFAULT_OLLAMA_GENERATE_TIMEOUT_MS = 120000
export const DEFAULT_OLLAMA_NUM_PREDICT = 2048
export const DEFAULT_OLLAMA_NUM_CTX = 4096
export const DEFAULT_MAX_REPAIR_ATTEMPTS = 2

export interface ProjectFeatures {
  customItems: boolean
  customMobs: boolean
  customGuis: boolean
  customBlocks: boolean
  recipes: boolean
}

export interface ProjectManifest {
  id: string
  name: string
  description: string
  type: ProjectKind
  platform: PlatformId
  minecraftVersion: string
  createdAt: string
  updatedAt: string
  features: ProjectFeatures
  schemaVersion: number
}

export interface ProjectSummary {
  id: string
  name: string
  description: string
  type: ProjectKind
  platform: PlatformId
  minecraftVersion: string
  updatedAt: string
  directoryName: string
}

export interface ProjectRecord {
  manifest: ProjectManifest
  directoryName: string
  directoryPath: string
}

export interface CreateProjectInput {
  name: string
  description: string
  type: ProjectKind
  platform: PlatformId
  minecraftVersion: string
  features?: Partial<ProjectFeatures>
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  features?: Partial<ProjectFeatures>
  minecraftVersion?: string
}

export interface AppSettings {
  schemaVersion: number
  projectsPath: string
  ollamaEndpoint: string
  ollamaTimeoutMs: number
  ollamaModel: string | null
  ollamaGenerateTimeoutMs: number
  ollamaNumPredict: number
  ollamaNumCtx: number
  maxRepairAttempts: number
  lastOpenedProjectId: string | null
  minecraftEulaAccepted: boolean
  runtimeTermsAcceptedAt: string | null
}

export interface SettingsPatch {
  projectsPath?: string
  ollamaEndpoint?: string
  ollamaTimeoutMs?: number
  ollamaModel?: string | null
  ollamaGenerateTimeoutMs?: number
  ollamaNumPredict?: number
  ollamaNumCtx?: number
  maxRepairAttempts?: number
  lastOpenedProjectId?: string | null
  minecraftEulaAccepted?: boolean
  runtimeTermsAcceptedAt?: string | null
}

export interface OllamaModel {
  name: string
  size?: number
  modifiedAt?: string
}

export interface OllamaStatus {
  connected: boolean
  endpoint: string
  models: OllamaModel[]
  message: string
  recovery: string
}

export interface CompatibilityEntry {
  platform: PlatformId
  minecraftVersion: string
  status: CompatibilityStatus
  notes: string
}

export type CapabilityLevel = 'supported' | 'limited' | 'unsupported'

export interface AdapterCapabilities {
  customItems: CapabilityLevel
  customBlocks: CapabilityLevel
  customEntities: CapabilityLevel
  clientEntities: CapabilityLevel
  customGuis: CapabilityLevel
  recipes: CapabilityLevel
  worldgen: CapabilityLevel
  biomeSpawns: CapabilityLevel
  serverCommands: CapabilityLevel
  textures: CapabilityLevel
  gradleProject: CapabilityLevel
}

export interface JavaRequirements {
  minVersion: number
  recommendedVersion: number
  notes: string
}

export interface AdapterTemplate {
  id: string
  displayName: string
  description: string
  status: 'stub' | 'available'
}

export interface ValidationRule {
  id: string
  description: string
  severity: 'error' | 'warning'
}

export interface TestProcedure {
  id: string
  displayName: string
  description: string
  status: 'stub' | 'available'
}

export interface PlatformAdapter {
  id: PlatformId
  displayName: string
  kind: ProjectKind
  supportedVersions: string[];
  capabilities: AdapterCapabilities
  javaRequirements: JavaRequirements
  templates: AdapterTemplate[]
  validationRules: ValidationRule[]
  testProcedures: TestProcedure[]
}

export interface PlatformAdapterInfo extends PlatformAdapter {
  compatibility: CompatibilityEntry[]
}

export const EMPTY_FEATURES: ProjectFeatures = {
  customItems: false,
  customMobs: false,
  customGuis: false,
  customBlocks: false,
  recipes: false
}

export const MOD_PLATFORMS: PlatformId[] = ['fabric', 'neoforge', 'forge']
export const PLUGIN_PLATFORMS: PlatformId[] = ['paper', 'spigot']
