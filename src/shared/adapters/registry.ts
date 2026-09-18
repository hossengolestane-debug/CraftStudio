import { AppError } from '../errors'
import { listCompatibility } from '../compatibility'
import type { RuntimeEvidenceRecord } from '../evidence'
import type { PlatformAdapter, PlatformAdapterInfo, PlatformId, ProjectKind } from '../types'
import { FabricAdapter } from './fabric'
import { ForgeAdapter } from './forge'
import { NeoForgeAdapter } from './neoforge'
import { PaperAdapter } from './paper'
import { SpigotAdapter } from './spigot'

export const PLATFORM_ADAPTERS: PlatformAdapter[] = [
  FabricAdapter,
  NeoForgeAdapter,
  ForgeAdapter,
  PaperAdapter,
  SpigotAdapter
]

const BY_ID = new Map(PLATFORM_ADAPTERS.map((adapter) => [adapter.id, adapter]))

export function listAdapters(evidence: RuntimeEvidenceRecord[] = []): PlatformAdapterInfo[] {
  return PLATFORM_ADAPTERS.map((adapter) => ({
    ...adapter,
    compatibility: listCompatibility(adapter.id, evidence)
  }))
}

export function getAdapter(id: PlatformId): PlatformAdapter {
  const adapter = BY_ID.get(id)
  if (!adapter) {
    throw new AppError({
      code: 'VALIDATION',
      message: `Unknown platform "${id}".`,
      action: 'Choose Fabric, NeoForge, Forge, Paper, or Spigot.'
    })
  }
  return adapter
}

export function adaptersForKind(kind: ProjectKind): PlatformAdapter[] {
  return PLATFORM_ADAPTERS.filter((adapter) => adapter.kind === kind)
}

export function describeCapabilityGap(adapter: PlatformAdapter, feature: keyof PlatformAdapter['capabilities']): string {
  const level = adapter.capabilities[feature]
  if (level === 'supported') {
    if (adapter.id === 'fabric' && feature === 'gradleProject') {
      return 'Fabric emits a real Gradle project for 1.21, 1.21.1, 1.21.2, 1.21.4, and 1.21.8.'
    }
    if (adapter.id === 'paper' && feature === 'gradleProject') {
      return 'Paper emits a real Gradle plugin for 1.21 / 1.21.1 / 1.21.4 / 1.21.8. Spigot is not inferred from that.'
    }
    if (adapter.id === 'neoforge' && feature === 'gradleProject') {
      return 'NeoForge emits a real ModDevGradle project for 1.21.1 / 1.21.4 / 1.21.8. That is not a Forge compatibility claim. Entity registration is 1.21.1 only.'
    }
    if (adapter.id === 'forge' && feature === 'gradleProject') {
      return 'Forge emits a real ForgeGradle project for 1.21.1 only. That is not a NeoForge compatibility claim.'
    }
    if (adapter.id === 'spigot' && feature === 'gradleProject') {
      return 'Spigot emits a real Gradle plugin for 1.21 / 1.21.1 / 1.21.4 using spigot-api only. Paper success is not Spigot compatibility.'
    }
    if ((adapter.id === 'paper' || adapter.id === 'spigot') && feature === 'customEntities') {
      return `${adapter.displayName} customizes existing vanilla mobs (zombie / pig / wolf). It cannot register a new client entity type.`
    }
    if (adapter.id === 'paper' && feature === 'textures') {
      return 'Paper items stay vanilla paper + CustomModelData. Clients must install the exported resource pack; the plugin jar cannot register a new item id.'
    }
    return `${adapter.displayName} can implement ${feature} in a later generation phase.`
  }
  if (level === 'limited') {
    return `${adapter.displayName} can only approximate ${feature} (vanilla ids, inventories, or disguises).`
  }
  return `${adapter.displayName} cannot implement ${feature}. Example: plugins cannot add arbitrary new client-side entities.`
}
