import { describe, expect, it } from 'vitest'
import { planFabricFiles } from '../src/main/codegen/fabric/emitter'
import { planForgeFiles } from '../src/main/codegen/forge/emitter'
import { planNeoForgeFiles } from '../src/main/codegen/neoforge/emitter'
import { planPaperFiles } from '../src/main/codegen/paper/emitter'
import { planAdapterFiles } from '../src/main/codegen/plan'
import { AppError } from '../src/shared/errors'
import { resolveMobGoals } from '../src/shared/goals'
import { parseProjectSpec } from '../src/shared/spec'
import { inferSpecFromPrompt } from '../src/shared/templateInfer'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

function manifestFor(
  platform: ProjectManifest['platform'],
  minecraftVersion: string,
  type: ProjectManifest['type'] = 'mod'
): ProjectManifest {
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
      customGuis: false,
      customBlocks: true,
      recipes: false
    },
    schemaVersion: MANIFEST_SCHEMA_VERSION
  }
}

const phase9Spec = parseProjectSpec({
  schemaVersion: 1,
  modId: 'river_stones',
  displayName: 'River Stones',
  description: 'Phase 9 slice',
  packageName: 'local.craftstudio.river_stones',
  mainClass: 'RiverStones',
  items: [{ id: 'river_pebble', displayName: 'River Pebble', maxCount: 16, rarity: 'common' }],
  blocks: [
    {
      id: 'river_stone_ore',
      displayName: 'River Stone Ore',
      material: 'stone',
      hardness: 3,
      resistance: 6,
      dropItem: 'river_pebble'
    }
  ],
  recipes: [],
  commands: [],
  mobs: [
    {
      id: 'stone_mite',
      displayName: 'Stone Mite',
      health: 12,
      preset: 'hostile_melee',
      targeting: 'players',
      goals: ['leap', 'melee', 'wander'],
      appearance: { model: 'humanoid', vanillaBase: 'minecraft:zombie' }
    }
  ],
  worldgen: [
    {
      id: 'river_ore_vein',
      kind: 'ore_vein',
      block: 'river_stone_ore',
      size: 8,
      count: 7,
      minY: -16,
      maxY: 48,
      biomes: ['plains']
    },
    {
      id: 'pebble_flowers',
      kind: 'surface_patch',
      block: 'minecraft:dandelion',
      size: 12,
      count: 8,
      minY: 0,
      maxY: 320,
      biomes: ['plains']
    }
  ],
  unsupportedRequests: [],
  source: 'editor',
  prompt: 'phase 9',
  config: {
    enableWorldgen: true,
    enableChestLoot: true,
    spawnWeightScale: 1,
    enableTerrainDestruction: true
  }
})

describe('Phase 9 spec + emitters', () => {
  it('rejects unknown block drops, overlapping item/block ids, extra goals, and invalid worldgen blocks', () => {
    expect(() =>
      parseProjectSpec({
        ...phase9Spec,
        blocks: [{ ...phase9Spec.blocks[0], dropItem: 'missing_drop' }]
      })
    ).toThrow(/unknown item/)
    expect(() =>
      parseProjectSpec({
        ...phase9Spec,
        blocks: [{ ...phase9Spec.blocks[0], id: 'river_pebble' }]
      })
    ).toThrow(/reuses an item id/)
    expect(() =>
      parseProjectSpec({
        ...phase9Spec,
        mobs: [{ ...phase9Spec.mobs[0], goals: ['wander', 'look_player', 'melee', 'flee', 'leap', 'follow_look'] }]
      })
    ).toThrow(/not valid/)
    try {
      parseProjectSpec({
        ...phase9Spec,
        mobs: [{ ...phase9Spec.mobs[0], goals: ['wander', 'look_player', 'melee', 'flee', 'leap', 'follow_look'] }]
      })
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).details ?? '').toMatch(/at most|Too big|goals/i)
    }
    expect(() =>
      parseProjectSpec({
        ...phase9Spec,
        mobs: [{ ...phase9Spec.mobs[0], goals: ['wander', 'wander'] }]
      })
    ).toThrow(/repeats a goal/)
    expect(() =>
      parseProjectSpec({
        ...phase9Spec,
        worldgen: [{ ...phase9Spec.worldgen[0], block: 'minecraft:dirt' }]
      })
    ).toThrow(/vanilla ore or spec block/)
    expect(() =>
      parseProjectSpec({
        ...phase9Spec,
        worldgen: [{ ...phase9Spec.worldgen[1], block: 'minecraft:oak_leaves' }]
      })
    ).toThrow(/allowlisted plant or spec block/)
  })

  it('expands empty goal lists from presets and keeps an explicit list', () => {
    expect(resolveMobGoals({ preset: 'leap_melee', goals: [] })).toEqual([
      { id: 'leap', priority: 1 },
      { id: 'melee', priority: 2 }
    ])
    expect(resolveMobGoals({ preset: 'passive_wanderer', goals: ['look_player', 'wander'] })).toEqual([
      { id: 'look_player', priority: 1 },
      { id: 'wander', priority: 2 }
    ])
  })

  it('emits Fabric block registration, mod-block ore, surface patch, loot inject, and composable goals', () => {
    const files = planFabricFiles(manifestFor('fabric', '1.21.1'), phase9Spec)
    const main = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(main).toContain('RIVER_STONE_ORE_BLOCK')
    expect(main).toContain('RIVER_STONE_ORE_BLOCK_ITEM')
    expect(main).toContain('import net.minecraft.item.BlockItem')
    expect(main).toContain('AbstractBlock.Settings.create()')
    expect(main).toContain('BlockSoundGroup.STONE')
    expect(main).toContain('LootTableEvents.MODIFY')
    expect(main).toContain('import net.fabricmc.fabric.api.loot.v2.LootTableEvents')
    expect(main).toContain('chests/simple_dungeon')
    expect(main).toContain('chests/abandoned_mineshaft')
    expect(main).toContain('chests/spawn_bonus_chest')
    expect(main).toContain('chests/village/village_toolsmith')
    expect(main).toContain('UNDERGROUND_ORES')
    expect(main).toContain('VEGETAL_DECORATION')
    expect(main).toContain('river_ore_vein')
    expect(main).toContain('pebble_flowers')

    const blockstate = files.find((file) => file.relativePath.endsWith('blockstates/river_stone_ore.json'))
      ?.contents.toString() ?? ''
    expect(blockstate).toContain('river_stones:block/river_stone_ore')
    const blockModel = files.find((file) => file.relativePath.endsWith('models/block/river_stone_ore.json'))
      ?.contents.toString() ?? ''
    expect(blockModel).toContain('minecraft:block/cube_all')
    const blockLoot = files.find((file) => file.relativePath.endsWith('loot_table/blocks/river_stone_ore.json'))
      ?.contents.toString() ?? ''
    expect(blockLoot).toContain('river_stones:river_pebble')

    const ore = files.find((file) => file.relativePath.endsWith('configured_feature/river_ore_vein.json'))
      ?.contents.toString() ?? ''
    expect(ore).toContain('minecraft:ore')
    expect(ore).toContain('river_stones:river_stone_ore')
    expect(ore).not.toContain('minecraft:deepslate_iron_ore')

    const patch = files.find((file) => file.relativePath.endsWith('configured_feature/pebble_flowers.json'))
      ?.contents.toString() ?? ''
    expect(patch).toContain('minecraft:random_patch')
    expect(patch).toContain('minecraft:simple_block')
    expect(patch).toContain('minecraft:dandelion')
    const placedPatch = files.find((file) => file.relativePath.endsWith('placed_feature/pebble_flowers.json'))
      ?.contents.toString() ?? ''
    expect(placedPatch).toContain('MOTION_BLOCKING')

    const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
    expect(entity).toContain('PounceAtTargetGoal')
    expect(entity).toContain('MeleeAttackGoal')
    expect(entity).toContain('WanderAroundFarGoal')

    const lootDoc = files.find((file) => file.relativePath === 'LOOT.md')?.contents.toString() ?? ''
    expect(lootDoc).toContain('simple_dungeon')
    expect(lootDoc).not.toContain('**not** injected')
    expect(files.some((file) => file.relativePath === 'BLOCKS.md')).toBe(true)
    expect(files.some((file) => file.relativePath === 'WORLDGEN.md')).toBe(true)

    const modern = planFabricFiles(manifestFor('fabric', '1.21.4'), phase9Spec)
    const modernMain = modern.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(modernMain).toContain('import net.fabricmc.fabric.api.loot.v3.LootTableEvents')
    expect(modernMain).toContain('registries')
    expect(modernMain).toContain('.registryKey(')
  })

  it('emits Forge and NeoForge block regs, GLM injection, and surface-patch biome modifiers', () => {
    const forge = planForgeFiles(manifestFor('forge', '1.21.1'), phase9Spec)
    const neo = planNeoForgeFiles(manifestFor('neoforge', '1.21.1'), phase9Spec)
    for (const files of [forge, neo]) {
      const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
      expect(java).toContain('RIVER_STONE_ORE_BLOCK')
      expect(java).toContain('ADD_BONUS_CHEST')
      expect(java).toContain('LOOT_MODIFIERS')
      expect(files.some((file) => file.relativePath.endsWith('AddBonusChestModifier.java'))).toBe(true)
      expect(files.some((file) => file.relativePath.endsWith('loot_modifiers/global_loot_modifiers.json'))).toBe(true)
      expect(files.some((file) => file.relativePath.includes('loot_modifiers/simple_dungeon.json'))).toBe(true)
      expect(files.some((file) => file.relativePath.includes('biome_modifier/river_ore_vein_ores.json'))).toBe(true)
      expect(files.some((file) => file.relativePath.includes('biome_modifier/pebble_flowers_patch.json'))).toBe(true)
      const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
      expect(entity).toContain('LeapAtTargetGoal')
      expect(entity).toContain('MeleeAttackGoal')
    }
    const forgeMod = forge.find((file) => file.relativePath.endsWith('AddBonusChestModifier.java'))?.contents.toString() ?? ''
    expect(forgeMod).toContain('net.minecraftforge.common.loot.LootModifier')
    expect(forgeMod).toContain('RIVER_PEBBLE.get()')
    const neoMod = neo.find((file) => file.relativePath.endsWith('AddBonusChestModifier.java'))?.contents.toString() ?? ''
    expect(neoMod).toContain('net.neoforged.neoforge.common.loot.LootModifier')
    const forgePatch = forge.find((file) => file.relativePath.includes('forge/biome_modifier/pebble_flowers_patch.json'))
      ?.contents.toString() ?? ''
    expect(forgePatch).toContain('vegetal_decoration')
    const neoPatch = neo.find((file) => file.relativePath.includes('neoforge/biome_modifier/pebble_flowers_patch.json'))
      ?.contents.toString() ?? ''
    expect(neoPatch).toContain('vegetal_decoration')
    const forgeGlm = forge.find((file) => file.relativePath.includes('data/forge/loot_modifiers/global_loot_modifiers.json'))
      ?.contents.toString() ?? ''
    expect(forgeGlm).toContain('river_stones:simple_dungeon')
    expect(forgeGlm).toContain('river_stones:village_village_toolsmith')
  })

  it('rejects plugin custom blocks at plan time and writes honest docs when asked', () => {
    expect(() => planAdapterFiles(manifestFor('paper', '1.21.1', 'plugin'), phase9Spec)).toThrow(AppError)
    expect(() =>
      planAdapterFiles(manifestFor('paper', '1.21.1', 'plugin'), parseProjectSpec({ ...phase9Spec, worldgen: [] }))
    ).toThrow(/cannot register custom blocks/)
    const paper = planPaperFiles(
      manifestFor('paper', '1.21.1', 'plugin'),
      parseProjectSpec({
        ...phase9Spec,
        blocks: [],
        worldgen: [],
        unsupportedRequests: [{ feature: 'custom blocks', reason: 'Paper cannot register a new block id.' }]
      })
    )
    const blocksDoc = paper.find((file) => file.relativePath === 'BLOCKS.md')?.contents.toString() ?? ''
    expect(blocksDoc).toContain('unsupported on plugins')
    expect(blocksDoc).not.toContain('Registry.register')
    const install = paper.find((file) => file.relativePath === 'INSTALL.md')?.contents.toString() ?? ''
    expect(install).toContain('cannot register custom blocks')
    expect(install).toContain('inject vanilla chest loot')
    const lootDoc = paper.find((file) => file.relativePath === 'LOOT.md')?.contents.toString() ?? ''
    expect(lootDoc).toContain('**not** injected')
  })

  it('infers a custom block and surface patch on mods, and reports plugin gaps', () => {
    const mod = inferSpecFromPrompt(
      manifestFor('fabric', '1.21.1'),
      'Add a custom stone block and a flower patch plus a wander mob'
    )
    expect(mod.blocks.length).toBe(1)
    expect(mod.worldgen.some((entry) => entry.kind === 'surface_patch')).toBe(true)
    expect(mod.mobs[0]?.preset).toBe('passive_wanderer')
    const plugin = inferSpecFromPrompt(manifestFor('paper', '1.21.1', 'plugin'), 'Add a custom stone block and iron ore veins')
    expect(plugin.blocks.length).toBe(0)
    expect(plugin.worldgen.length).toBe(0)
    expect(plugin.unsupportedRequests.some((item) => item.feature === 'custom blocks')).toBe(true)
    expect(plugin.unsupportedRequests.some((item) => item.feature === 'worldgen')).toBe(true)
  })
})
