import { AppError } from '../errors'
import { listCompatibility } from '../compatibility'
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

export function listAdapters(): PlatformAdapterInfo[] {
  return PLATFORM_ADAPTERS.map((adapter) => ({
    ...adapter,
    compatibility: listCompatibility(adapter.id)
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
    return `${adapter.displayName} can implement ${feature} in a later generation phase.`
  }
  if (level === 'limited') {
    return `${adapter.displayName} can only approximate ${feature} (vanilla ids, inventories, or disguises).`
  }
  return `${adapter.displayName} cannot implement ${feature}. Example: plugins cannot add arbitrary new client-side entities.`
}
