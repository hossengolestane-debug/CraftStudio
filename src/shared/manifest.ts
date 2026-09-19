import { AppError } from './errors'
import { STORED_PROMPT_MAX } from './promptPreserve'
import {
  EMPTY_FEATURES,
  MANIFEST_SCHEMA_VERSION,
  MOD_PLATFORMS,
  PLATFORM_IDS,
  PLUGIN_PLATFORMS,
  PROJECT_KINDS,
  type PlatformId,
  type ProjectFeatures,
  type ProjectKind,
  type ProjectManifest
} from './types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fail(message: string, details?: string): never {
  throw new AppError({
    code: 'MANIFEST_INVALID',
    message,
    action: 'Fix the project manifest fields and try again.',
    details
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string, min = 1, max = 200): string {
  const value = record[key]
  if (typeof value !== 'string') {
    fail(`"${key}" must be a string.`)
  }
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) {
    fail(`"${key}" must be between ${min} and ${max} characters.`)
  }
  return trimmed
}

function readDate(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key, 10, 40)
  if (!ISO_DATE.test(value)) {
    fail(`"${key}" must be an ISO-8601 UTC timestamp.`, value)
  }
  return value
}

function readFeatures(value: unknown): ProjectFeatures {
  if (!isRecord(value)) {
    fail('"features" must be an object.')
  }

  const features: ProjectFeatures = { ...EMPTY_FEATURES }
  for (const key of Object.keys(features) as (keyof ProjectFeatures)[]) {
    const entry = value[key]
    if (entry === undefined) {
      continue
    }
    if (typeof entry !== 'boolean') {
      fail(`"features.${key}" must be a boolean.`)
    }
    features[key] = entry
  }
  return features
}

export function platformMatchesKind(platform: PlatformId, kind: ProjectKind): boolean {
  if (kind === 'mod') {
    return MOD_PLATFORMS.includes(platform)
  }
  return PLUGIN_PLATFORMS.includes(platform)
}

export function validateManifest(input: unknown): ProjectManifest {
  if (!isRecord(input)) {
    fail('Manifest must be a JSON object.')
  }

  const id = readString(input, 'id', 8, 80)
  if (!UUID.test(id)) {
    fail('"id" must be a UUID.', id)
  }

  const name = readString(input, 'name', 1, 80)
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (description.length > STORED_PROMPT_MAX) {
    fail(`"description" must be ${STORED_PROMPT_MAX} characters or fewer.`)
  }

  const type = readString(input, 'type', 3, 20)
  if (!PROJECT_KINDS.includes(type as ProjectKind)) {
    fail('"type" must be "mod" or "plugin".', type)
  }

  const platform = readString(input, 'platform', 3, 20)
  if (!PLATFORM_IDS.includes(platform as PlatformId)) {
    fail(
      '"platform" must be one of fabric, neoforge, forge, paper, or spigot.',
      platform
    )
  }

  if (!platformMatchesKind(platform as PlatformId, type as ProjectKind)) {
    fail(
      `Platform "${platform}" does not match project type "${type}".`,
      'Mods use Fabric, NeoForge, or Forge. Plugins use Paper or Spigot.'
    )
  }

  const minecraftVersion = readString(input, 'minecraftVersion', 3, 32)
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(minecraftVersion)) {
    fail('"minecraftVersion" must look like 1.21.1.', minecraftVersion)
  }

  const createdAt = readDate(input, 'createdAt')
  const updatedAt = readDate(input, 'updatedAt')
  const features = readFeatures(input.features)

  const schemaVersion = input.schemaVersion
  if (schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    fail(
      `"schemaVersion" must be ${MANIFEST_SCHEMA_VERSION}.`,
      `Received ${String(schemaVersion)}`
    )
  }

  return {
    id,
    name,
    description,
    type: type as ProjectKind,
    platform: platform as PlatformId,
    minecraftVersion,
    createdAt,
    updatedAt,
    features,
    schemaVersion: MANIFEST_SCHEMA_VERSION
  }
}

export function parseManifestJson(raw: string): ProjectManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    fail('Manifest JSON could not be parsed.', error instanceof Error ? error.message : String(error))
  }
  return validateManifest(parsed)
}
