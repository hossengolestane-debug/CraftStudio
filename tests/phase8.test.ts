import { describe, expect, it } from 'vitest'
import { planFabricFiles } from '../src/main/codegen/fabric/emitter'
import { planForgeFiles } from '../src/main/codegen/forge/emitter'
import { planNeoForgeFiles } from '../src/main/codegen/neoforge/emitter'
import { planPaperFiles } from '../src/main/codegen/paper/emitter'
import { planAdapterFiles } from '../src/main/codegen/plan'
import { AppError } from '../src/shared/errors'
import { assessDoctor } from '../src/shared/doctor'
import { parseProjectSpec } from '../src/shared/spec'
import { inferSpecFromPrompt } from '../src/shared/templateInfer'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

function manifestFor(platform: ProjectManifest['platform'], minecraftVersion: string, type: ProjectManifest['type'] = 'mod'): ProjectManifest {
  return {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    name: 'River Stones',
    description: 'Adds polished river stones.',
    type,
    platform,
    minecraftVersion,
    createdAt: '2026-09-18T01:00:00.000Z',
    updatedAt: '2026-09-18T01:00:00.000Z',
    features: {
      customItems: true,
      customMobs: true,
      customGuis: true,
      customBlocks: false,
      recipes: true
    },
    schemaVersion: MANIFEST_SCHEMA_VERSION
  }
}

const phase8Spec = parseProjectSpec({
  schemaVersion: 1,
  modId: 'river_stones',
  displayName: 'River Stones',
  description: 'Phase 8 slice',
  packageName: 'local.craftstudio.river_stones',
  mainClass: 'RiverStones',
  items: [
    {
      id: 'river_pick',
      displayName: 'River Pick',
      maxCount: 1,
      rarity: 'uncommon',
      durability: 250,
      attributes: [{ id: 'attack_damage', amount: 2, slot: 'mainhand' }]
    }
  ],
  recipes: [
    {
      id: 'river_pick_shaped',
      type: 'shaped',
      resultItemId: 'river_pick',
      resultCount: 1,
      pattern: [' X ', ' X ', ' S '],
      keys: [
        { symbol: 'X', kind: 'vanilla', id: 'minecraft:iron_ingot' },
        { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
      ]
    }
  ],
  commands: [],
  mobs: [
    {
      id: 'stone_mite',
      displayName: 'Stone Mite',
      health: 12,
      preset: 'leap_melee',
      targeting: 'players',
      appearance: { model: 'humanoid', vanillaBase: 'minecraft:zombie' },
      drops: [{ itemId: 'minecraft:iron_ingot', chance: 0.5, min: 1, max: 2 }]
    },
    {
      id: 'pebble_pup',
      displayName: 'Pebble Pup',
      health: 8,
      preset: 'follow_player',
      targeting: 'none',
      appearance: { model: 'quadruped', vanillaBase: 'minecraft:wolf' }
    }
  ],
  modGuis: [
    {
      id: 'example_screen',
      title: 'Preview',
      width: 176,
      height: 166,
      widgets: [
        { id: 'title_label', kind: 'label', x: 8, y: 6, width: 80, height: 12, text: 'Preview', action: 'none' },
        { id: 'slot_0', kind: 'slot', x: 80, y: 60, width: 18, height: 18, text: '', action: 'none' }
      ],
      dataSlots: [{ id: 'progress', initial: 3, ghostItemId: 'minecraft:iron_ingot' }]
    }
  ],
  worldgen: [
    {
      id: 'iron_vein',
      kind: 'ore_vein',
      block: 'minecraft:iron_ore',
      size: 9,
      count: 10,
      minY: -24,
      maxY: 56,
      biomes: ['plains', 'forest']
    }
  ],
  unsupportedRequests: [],
  source: 'editor',
  prompt: 'phase 8'
})

describe('Phase 8 spec + emitters', () => {
  it('rejects durability with stack size > 1 and unused shaped keys', () => {
    expect(() =>
      parseProjectSpec({
        ...phase8Spec,
        items: [{ id: 'river_pick', displayName: 'River Pick', maxCount: 16, durability: 10 }]
      })
    ).toThrow(/durability/)
    expect(() =>
      parseProjectSpec({
        ...phase8Spec,
        recipes: [
          {
            id: 'bad_shaped',
            type: 'shaped',
            resultItemId: 'river_pick',
            pattern: [' X '],
            keys: [
              { symbol: 'X', kind: 'vanilla', id: 'minecraft:iron_ingot' },
              { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
            ]
          }
        ]
      })
    ).toThrow(/unused/)
  })

  it('emits Fabric worldgen, shaped recipe, loot, durability, new presets, and menu data slots', () => {
    const files = planFabricFiles(manifestFor('fabric', '1.21.1'), phase8Spec)
    const main = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(main).toContain('maxDamage(250)')
    expect(main).toContain('AttributeModifiersComponent')
    expect(main).toContain('BiomeModifications.addFeature')
    expect(main).toContain('UNDERGROUND_ORES')
    expect(main).toContain('iron_vein')
    const configured = files.find((file) =>
      file.relativePath.endsWith('worldgen/configured_feature/iron_vein.json')
    )?.contents.toString() ?? ''
    expect(configured).toContain('minecraft:ore')
    expect(configured).toContain('minecraft:iron_ore')
    const placed = files.find((file) => file.relativePath.endsWith('worldgen/placed_feature/iron_vein.json'))
      ?.contents.toString() ?? ''
    expect(placed).toContain('"feature": "river_stones:iron_vein"')
    const recipe = files.find((file) => file.relativePath.endsWith('recipe/river_pick_shaped.json'))?.contents.toString() ?? ''
    expect(recipe).toContain('minecraft:crafting_shaped')
    expect(recipe).toContain('"X"')
    const loot = files.find((file) => file.relativePath.endsWith('loot_table/entities/stone_mite.json'))?.contents.toString() ?? ''
    expect(loot).toContain('minecraft:entity')
    expect(loot).toContain('minecraft:iron_ingot')
    const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
    expect(entity).toContain('LeapAtTargetGoal')
    const follower = files.find((file) => file.relativePath.endsWith('PebblePupEntity.java'))?.contents.toString() ?? ''
    expect(follower).toContain('LookAtEntityGoal')
    const handler = files.find((file) => file.relativePath.endsWith('ExampleScreenHandler.java'))?.contents.toString() ?? ''
    expect(handler).toContain('ArrayPropertyDelegate')
    expect(handler).toContain('addProperties')
    expect(handler).toContain('getSyncedData')
    const screen = files.find((file) => file.relativePath.endsWith('ExampleScreen.java'))?.contents.toString() ?? ''
    expect(screen).toContain('getSyncedData')
    expect(screen).toContain('drawItem')
    expect(files.some((file) => file.relativePath === 'WORLDGEN.md')).toBe(true)
    expect(files.some((file) => file.relativePath === 'LOOT.md')).toBe(true)
  })

  it('emits Forge and NeoForge goldens for the same slice', () => {
    const forge = planForgeFiles(manifestFor('forge', '1.21.1'), phase8Spec)
    const neo = planNeoForgeFiles(manifestFor('neoforge', '1.21.1'), phase8Spec)
    for (const files of [forge, neo]) {
      const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
      expect(java).toContain('durability(250)')
      expect(java).toContain('ItemAttributeModifiers')
      expect(files.some((file) => file.relativePath.includes('biome_modifier/iron_vein_ores.json'))).toBe(true)
      expect(files.some((file) => file.relativePath.endsWith('recipe/river_pick_shaped.json'))).toBe(true)
      expect(files.some((file) => file.relativePath.endsWith('loot_table/entities/stone_mite.json'))).toBe(true)
      const menu = files.find((file) => file.relativePath.endsWith('ExampleMenu.java'))?.contents.toString() ?? ''
      expect(menu).toContain('SimpleContainerData')
      expect(menu).toContain('addDataSlots')
      const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
      expect(entity).toContain('LeapAtTargetGoal')
    }
    const forgeModifier = forge.find((file) => file.relativePath.includes('forge/biome_modifier/iron_vein_ores.json'))
      ?.contents.toString() ?? ''
    expect(forgeModifier).toContain('forge:add_features')
    const neoModifier = neo.find((file) => file.relativePath.includes('neoforge/biome_modifier/iron_vein_ores.json'))
      ?.contents.toString() ?? ''
    expect(neoModifier).toContain('neoforge:add_features')
  })

  it('rejects plugin worldgen and writes an honest WORLDGEN.md only when requested via planner docs', () => {
    expect(() => planAdapterFiles(manifestFor('paper', '1.21.1', 'plugin'), phase8Spec)).toThrow(AppError)
    const paper = planPaperFiles(manifestFor('paper', '1.21.1', 'plugin'), parseProjectSpec({ ...phase8Spec, worldgen: [] }))
    expect(paper.some((file) => file.relativePath.endsWith('recipe/river_pick_shaped.json'))).toBe(false)
    const java = paper.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(java).toContain('ShapedRecipe')
    expect(java).toContain('CraftStudioDropsListener')
    expect(java).toContain('EntityDeathEvent')
  })

  it('infers an ore vein on mods and reports the plugin gap', () => {
    const mod = inferSpecFromPrompt(manifestFor('fabric', '1.21.1'), 'Add iron ore veins and a shaped recipe')
    expect(mod.worldgen.length).toBe(1)
    expect(mod.recipes[0]?.type).toBe('shaped')
    const plugin = inferSpecFromPrompt(manifestFor('paper', '1.21.1', 'plugin'), 'Add iron ore veins')
    expect(plugin.worldgen.length).toBe(0)
    expect(plugin.unsupportedRequests.some((item) => item.feature === 'worldgen')).toBe(true)
  })

  it('reports JDK major and wrapper failures from the doctor', () => {
    const missing = assessDoctor({
      javaAvailable: false,
      javaVersion: null,
      requiredJava: 21,
      hasGradlew: false,
      hasWrapperJar: false,
      hasWrapperProps: false
    })
    expect(missing.some((item) => item.id === 'jdk-missing' && !item.ok)).toBe(true)
    expect(missing.some((item) => item.id === 'wrapper-missing' && !item.ok)).toBe(true)
    const old = assessDoctor({
      javaAvailable: true,
      javaVersion: 17,
      requiredJava: 21,
      hasGradlew: true,
      hasWrapperJar: true,
      hasWrapperProps: true,
      lastBuildLogs: 'Could not resolve net.fabricmc:fabric-loader'
    })
    expect(old.some((item) => item.id === 'jdk-major' && !item.ok)).toBe(true)
    expect(old.some((item) => item.id === 'offline-cache' && !item.ok)).toBe(true)
  })
})
