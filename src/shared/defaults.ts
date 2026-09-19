import { DEFAULT_MOB_SPAWN } from './spawn'
import type { SpecMob, SpecModGui, SpecPluginGui } from './spec'

export function defaultMob(id = 'custom_mob'): SpecMob {
  return {
    id,
    displayName: 'Custom Mob',
    health: 20,
    movementSpeed: 0.25,
    attackDamage: 3,
    preset: 'passive_wanderer',
    targeting: 'none',
    followRange: 16,
    spawnStub: 'Summon/command always works. Enable a biome spawn table for Fabric/Forge/NeoForge (not plugins).',
    spawn: { ...DEFAULT_MOB_SPAWN },
    drops: [],
    goals: [],
    appearance: { model: 'humanoid', vanillaBase: 'minecraft:zombie' }
  }
}

export function defaultModGui(id = 'example_screen'): SpecModGui {
  return {
    id,
    title: 'Example Screen',
    width: 176,
    height: 166,
    dataSlots: [],
    widgets: [
      { id: 'title_label', kind: 'label', x: 8, y: 6, width: 160, height: 12, text: 'Preview only', action: 'none' },
      { id: 'slot_0', kind: 'slot', x: 80, y: 60, width: 18, height: 18, text: '', action: 'none' },
      { id: 'done', kind: 'button', x: 48, y: 130, width: 80, height: 20, text: 'Close', action: 'close' }
    ]
  }
}

export function defaultPluginGui(id = 'example_menu'): SpecPluginGui {
  return {
    id,
    title: 'Example Menu',
    rows: 3,
    pagination: true,
    slots: [
      {
        index: 11,
        iconKind: 'vanilla',
        iconId: 'minecraft:paper',
        label: 'Info',
        action: 'message'
      },
      {
        index: 15,
        iconKind: 'vanilla',
        iconId: 'minecraft:barrier',
        label: 'Close',
        action: 'close'
      }
    ]
  }
}
