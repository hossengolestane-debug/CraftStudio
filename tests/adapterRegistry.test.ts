import { describe, expect, it } from 'vitest'
import { FabricAdapter } from '../src/shared/adapters/fabric'
import { ForgeAdapter } from '../src/shared/adapters/forge'
import { NeoForgeAdapter } from '../src/shared/adapters/neoforge'
import { PaperAdapter } from '../src/shared/adapters/paper'
import {
  adaptersForKind,
  describeCapabilityGap,
  getAdapter,
  listAdapters,
  PLATFORM_ADAPTERS
} from '../src/shared/adapters/registry'
import { SpigotAdapter } from '../src/shared/adapters/spigot'

describe('adapter registry', () => {
  it('registers the five Phase 1 adapters', () => {
    expect(PLATFORM_ADAPTERS.map((adapter) => adapter.id).sort()).toEqual([
      'fabric',
      'forge',
      'neoforge',
      'paper',
      'spigot'
    ])
    expect(FabricAdapter.id).toBe('fabric')
    expect(NeoForgeAdapter.id).toBe('neoforge')
    expect(ForgeAdapter.id).toBe('forge')
    expect(PaperAdapter.id).toBe('paper')
    expect(SpigotAdapter.id).toBe('spigot')
  })

  it('exposes the PlatformAdapter contract fields', () => {
    for (const adapter of PLATFORM_ADAPTERS) {
      expect(adapter.displayName.length).toBeGreaterThan(0)
      expect(['mod', 'plugin']).toContain(adapter.kind)
      expect(adapter.supportedVersions.length).toBeGreaterThan(0)
      expect(adapter.capabilities).toBeTruthy()
      expect(adapter.javaRequirements.minVersion).toBeGreaterThan(0)
      expect(adapter.templates.length).toBeGreaterThan(0)
      expect(adapter.validationRules.length).toBeGreaterThan(0)
      expect(adapter.testProcedures.length).toBeGreaterThan(0)
    }
  })

  it('groups adapters by project kind', () => {
    expect(adaptersForKind('mod').map((adapter) => adapter.id)).toEqual(['fabric', 'neoforge', 'forge'])
    expect(adaptersForKind('plugin').map((adapter) => adapter.id)).toEqual(['paper', 'spigot'])
  })

  it('looks up adapters by id and reports capability gaps', () => {
    expect(getAdapter('paper').kind).toBe('plugin')
    expect(describeCapabilityGap(PaperAdapter, 'clientEntities')).toMatch(/cannot implement/)
    expect(describeCapabilityGap(FabricAdapter, 'clientEntities')).toMatch(/can implement/)
  })

  it('includes compatibility rows on listAdapters()', () => {
    const fabric = listAdapters().find((adapter) => adapter.id === 'fabric')
    expect(fabric?.compatibility.some((row) => row.minecraftVersion === '1.21.1')).toBe(true)
  })

  it('marks plugin client entities and textures unsupported', () => {
    expect(PaperAdapter.capabilities.clientEntities).toBe('unsupported')
    expect(SpigotAdapter.capabilities.clientEntities).toBe('unsupported')
    expect(PaperAdapter.capabilities.textures).toBe('unsupported')
    expect(SpigotAdapter.capabilities.customBlocks).toBe('unsupported')
  })
})
