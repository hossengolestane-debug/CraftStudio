import { describe, expect, it } from 'vitest'
import { defaultMob, defaultModGui, defaultPluginGui } from '../src/shared/defaults'
import { itemModelJson } from '../src/shared/itemModels'
import { assessVersionChange } from '../src/shared/migration'
import { parseProjectSpec } from '../src/shared/spec'
import { EMPTY_FEATURES } from '../src/shared/types'

const base = {
  schemaVersion: 1 as const,
  modId: 'river_stones',
  displayName: 'River Stones',
  description: 'Adds polished river stones.',
  packageName: 'local.craftstudio.river_stones',
  mainClass: 'RiverStones',
  items: [{ id: 'river_stone', displayName: 'River Stone', maxCount: 16, rarity: 'common' as const }],
  recipes: [],
  commands: [],
  unsupportedRequests: [],
  source: 'template' as const,
  prompt: 'item'
}

describe('Phase 5 spec + migration + models', () => {
  it('accepts preset mobs and rejects unknown drop items / inverted drop ranges', () => {
    const ok = parseProjectSpec({
      ...base,
      mobs: [{ ...defaultMob('stone_mite'), drops: [{ itemId: 'river_stone', chance: 1, min: 1, max: 2 }] }]
    })
    expect(ok.mobs[0]?.preset).toBe('passive_wanderer')
    expect(() =>
      parseProjectSpec({
        ...base,
        mobs: [{ ...defaultMob('stone_mite'), drops: [{ itemId: 'missing_item', chance: 1, min: 1, max: 1 }] }]
      })
    ).toThrow(/unknown item/)
    expect(() =>
      parseProjectSpec({
        ...base,
        mobs: [{ ...defaultMob('stone_mite'), drops: [{ itemId: 'minecraft:bone', chance: 1, min: 4, max: 1 }] }]
      })
    ).toThrow(/max < min/)
  })

  it('validates plugin GUI slots and give targets', () => {
    expect(() =>
      parseProjectSpec({
        ...base,
        pluginGuis: [
          {
            ...defaultPluginGui(),
            pagination: false,
            slots: [{ index: 40, iconKind: 'vanilla', iconId: 'minecraft:paper', label: 'Bad', action: 'none' }]
          }
        ]
      })
    ).toThrow(/outside/)
    expect(() =>
      parseProjectSpec({
        ...base,
        pluginGuis: [
          {
            ...defaultPluginGui(),
            slots: [{ index: 1, iconKind: 'vanilla', iconId: 'minecraft:paper', label: 'Give', action: 'give', giveItemId: 'nope' }]
          }
        ]
      })
    ).toThrow(/unknown item/)
    const ok = parseProjectSpec({ ...base, pluginGuis: [defaultPluginGui()], modGuis: [defaultModGui()] })
    expect(ok.pluginGuis[0]?.pagination).toBe(true)
    expect(ok.modGuis[0]?.widgets.some((widget) => widget.kind === 'slot')).toBe(true)
    const overflow = parseProjectSpec({
      ...base,
      pluginGuis: [
        {
          ...defaultPluginGui(),
          pagination: true,
          slots: [{ index: 40, iconKind: 'vanilla', iconId: 'minecraft:paper', label: 'Page two', action: 'none' }]
        }
      ]
    })
    expect(overflow.pluginGuis[0]?.slots[0]?.index).toBe(40)
  })

  it('emits handheld and layer1 item model JSON', () => {
    const handheld = itemModelJson('river_stones', {
      id: 'river_stone',
      displayName: 'River Stone',
      description: '',
      maxCount: 16,
      rarity: 'common',
      modelStyle: 'handheld',
      layer1: true,
      durability: 0,
      attributes: []
    })
    expect(handheld).toContain('minecraft:item/handheld')
    expect(handheld).toContain('layer1')
    expect(handheld).toContain('river_stones:item/river_stone_layer1')
  })

  it('assesses version changes honestly', () => {
    const blocked = assessVersionChange('forge', '1.21.1', '1.21.8', { ...EMPTY_FEATURES, customItems: true })
    expect(blocked.canApply).toBe(false)
    expect(blocked.incompatible.join(' ')).toMatch(/1\.21\.1/)

    const spigot = assessVersionChange('spigot', '1.21.1', '1.21.8', EMPTY_FEATURES)
    expect(spigot.canApply).toBe(false)

    const neo = assessVersionChange('neoforge', '1.21.1', '1.21.4', { ...EMPTY_FEATURES, customMobs: true })
    expect(neo.canApply).toBe(true)
    expect(neo.notes.join(' ')).toMatch(/1\.21\.4/)
  })
})
