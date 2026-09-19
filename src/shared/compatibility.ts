import { AppError } from './errors'
import { hasValidEvidence, overlayCompatibility, type RuntimeEvidenceRecord } from './evidence'
import type { CompatibilityEntry, CompatibilityStatus, PlatformId } from './types'

export const REGISTRY_HONESTY_NOTE =
  'Static registry rows stay Experimental. A row may flip to Tested only when a runtime evidence record exists (timestamp, platform, version, what was verified). Compile-only Gradle success is never enough.'

const NOTE = {
  experimental:
    'Listed from public loader or plugin documentation. Not verified by a CraftStudio Minecraft build.',
  unsupported:
    'This platform did not ship this Minecraft version, or support is too uncertain to offer in the wizard.',
  neoforgeOld: 'NeoForge exists from 1.20.2 onward. Earlier versions are unsupported.',
  forgeLag:
    'Forge often trails the newest Minecraft releases. Treat this combination as unverified.',
  pluginNew:
    'Paper and Spigot publish per Minecraft version. This row is documentary only — no server jar was tested.'
} as const

type Row = [PlatformId, string, CompatibilityStatus, string]

const ROWS: Row[] = [
  ['fabric', '1.18.2', 'experimental', NOTE.experimental],
  ['fabric', '1.19.4', 'experimental', NOTE.experimental],
  ['fabric', '1.20.1', 'experimental', NOTE.experimental],
  ['fabric', '1.20.4', 'experimental', NOTE.experimental],
  ['fabric', '1.20.6', 'experimental', NOTE.experimental],
  ['fabric', '1.21', 'experimental', NOTE.experimental],
  ['fabric', '1.21.1', 'experimental', NOTE.experimental],
  ['fabric', '1.21.2', 'experimental', NOTE.experimental],
  ['fabric', '1.21.4', 'experimental', NOTE.experimental],
  ['fabric', '1.21.8', 'experimental', NOTE.experimental],

  ['neoforge', '1.18.2', 'unsupported', NOTE.neoforgeOld],
  ['neoforge', '1.19.4', 'unsupported', NOTE.neoforgeOld],
  ['neoforge', '1.20.1', 'unsupported', NOTE.neoforgeOld],
  ['neoforge', '1.20.4', 'experimental', NOTE.experimental],
  ['neoforge', '1.20.6', 'experimental', NOTE.experimental],
  ['neoforge', '1.21', 'experimental', NOTE.experimental],
  ['neoforge', '1.21.1', 'experimental', NOTE.experimental],
  ['neoforge', '1.21.4', 'experimental', NOTE.experimental],
  ['neoforge', '1.21.8', 'experimental', NOTE.experimental],

  ['forge', '1.18.2', 'experimental', NOTE.experimental],
  ['forge', '1.19.4', 'experimental', NOTE.experimental],
  ['forge', '1.20.1', 'experimental', NOTE.experimental],
  ['forge', '1.20.4', 'experimental', NOTE.experimental],
  ['forge', '1.20.6', 'experimental', NOTE.experimental],
  ['forge', '1.21', 'experimental', NOTE.experimental],
  ['forge', '1.21.1', 'experimental', NOTE.experimental],
  ['forge', '1.21.4', 'experimental', NOTE.forgeLag],
  ['forge', '1.21.8', 'experimental', NOTE.forgeLag],

  ['paper', '1.18.2', 'experimental', NOTE.pluginNew],
  ['paper', '1.19.4', 'experimental', NOTE.pluginNew],
  ['paper', '1.20.1', 'experimental', NOTE.pluginNew],
  ['paper', '1.20.4', 'experimental', NOTE.pluginNew],
  ['paper', '1.20.6', 'experimental', NOTE.pluginNew],
  ['paper', '1.21', 'experimental', NOTE.pluginNew],
  ['paper', '1.21.1', 'experimental', NOTE.pluginNew],
  ['paper', '1.21.4', 'experimental', NOTE.pluginNew],
  ['paper', '1.21.8', 'experimental', NOTE.pluginNew],

  ['spigot', '1.18.2', 'experimental', NOTE.pluginNew],
  ['spigot', '1.19.4', 'experimental', NOTE.pluginNew],
  ['spigot', '1.20.1', 'experimental', NOTE.pluginNew],
  ['spigot', '1.20.4', 'experimental', NOTE.pluginNew],
  ['spigot', '1.20.6', 'experimental', NOTE.pluginNew],
  ['spigot', '1.21', 'experimental', NOTE.pluginNew],
  ['spigot', '1.21.1', 'experimental', NOTE.pluginNew],
  ['spigot', '1.21.4', 'experimental', NOTE.pluginNew],
  ['spigot', '1.21.8', 'unsupported', NOTE.unsupported]
]

export const COMPATIBILITY_REGISTRY: CompatibilityEntry[] = ROWS.map(
  ([platform, minecraftVersion, status, notes]) => ({
    platform,
    minecraftVersion,
    status,
    notes
  })
)

export function listCompatibility(
  platform: PlatformId,
  evidence: RuntimeEvidenceRecord[] = []
): CompatibilityEntry[] {
  return overlayCompatibility(
    COMPATIBILITY_REGISTRY.filter((entry) => entry.platform === platform),
    evidence
  )
}

export function lookupCompatibility(
  platform: PlatformId,
  minecraftVersion: string,
  evidence: RuntimeEvidenceRecord[] = []
): CompatibilityEntry {
  const match = COMPATIBILITY_REGISTRY.find(
    (entry) => entry.platform === platform && entry.minecraftVersion === minecraftVersion
  )

  if (match) {
    return overlayCompatibility([match], evidence)[0]!
  }

  return {
    platform,
    minecraftVersion,
    status: 'unsupported',
    notes: 'This version is not in the compatibility registry.'
  }
}

export function assertCreatableCombination(
  platform: PlatformId,
  minecraftVersion: string,
  evidence: RuntimeEvidenceRecord[] = []
): CompatibilityEntry {
  const staticEntry = COMPATIBILITY_REGISTRY.find(
    (entry) => entry.platform === platform && entry.minecraftVersion === minecraftVersion
  )
  const entry = lookupCompatibility(platform, minecraftVersion, evidence)
  if (entry.status === 'unsupported') {
    throw new AppError({
      code: 'UNSUPPORTED_COMBINATION',
      message: `${platform} + Minecraft ${minecraftVersion} is unsupported.`,
      action: 'Choose a version marked Experimental (or Tested, when evidence exists).',
      details: entry.notes
    })
  }
  if (staticEntry?.status === 'tested' && !hasValidEvidence(evidence, platform, minecraftVersion)) {
    throw new AppError({
      code: 'UNSUPPORTED_COMBINATION',
      message: 'A Tested badge appeared in the static registry without a runtime evidence record.',
      action: 'This is a CraftStudio bug. Use an Experimental version and report the registry row.',
      details: `${platform} ${minecraftVersion}`
    })
  }
  return entry
}

export function listRegistryVersions(): string[] {
  return [...new Set(COMPATIBILITY_REGISTRY.map((entry) => entry.minecraftVersion))]
}
