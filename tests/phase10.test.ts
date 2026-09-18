import { describe, expect, it } from 'vitest'
import { planFabricFiles } from '../src/main/codegen/fabric/emitter'
import { planForgeFiles } from '../src/main/codegen/forge/emitter'
import { planNeoForgeFiles } from '../src/main/codegen/neoforge/emitter'
import { planStandaloneDatapack } from '../src/main/codegen/pack/datapack'
import { formatEvidenceSummary } from '../src/shared/evidence'
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
    description: 'Phase 10 slice',
    type,
    platform,
    minecraftVersion,
    createdAt: '2026-09-18T05:00:00.000Z',
    updatedAt: '2026-09-18T05:00:00.000Z',
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

const phase10Spec = parseProjectSpec({
  schemaVersion: 1,
  modId: 'river_stones',
  displayName: 'River Stones',
  description: 'Phase 10 slice',
  packageName: 'local.craftstudio.river_stones',
  mainClass: 'RiverStones',
  items: [{ id: 'river_pebble', displayName: 'River Pebble', maxCount: 16, rarity: 'common' }],
  blocks: [
    {
      id: 'river_pillar',
      displayName: 'River Pillar',
      material: 'stone',
      hardness: 1.5,
      resistance: 6,
      dropItem: 'self',
      shape: 'pillar',
      slab: true,
      stairs: true
    },
    {
      id: 'river_brick',
      displayName: 'River Brick',
      material: 'stone',
      hardness: 2,
      resistance: 6,
      dropItem: 'self',
      shape: 'cube_all',
      slab: true,
      stairs: false
    }
  ],
  recipes: [],
  commands: [],
  mobs: [
    {
      id: 'stone_mite',
      displayName: 'Stone Mite',
      health: 12,
      attackDamage: 5,
      followRange: 24,
      preset: 'hostile_melee',
      targeting: 'both',
      goals: [
        { id: 'leap', priority: 1 },
        { id: 'melee', priority: 3 }
      ],
      spawn: { enabled: true, biomes: ['plains'], weight: 8, minGroup: 1, maxGroup: 2 },
      appearance: { model: 'humanoid', vanillaBase: 'minecraft:zombie' }
    }
  ],
  worldgen: [
    {
      id: 'stone_spring',
      kind: 'spring',
      block: 'minecraft:water',
      size: 4,
      count: 8,
      minY: -24,
      maxY: 64,
      biomes: ['plains']
    }
  ],
  config: { enableWorldgen: true, enableChestLoot: true, spawnWeightScale: 2 },
  unsupportedRequests: [],
  source: 'editor',
  prompt: 'phase 10'
})

describe('Phase 10 spec + emitters', () => {
  it('rejects colliding slab/stairs ids and invalid spring fluids', () => {
    expect(() =>
      parseProjectSpec({
        ...phase10Spec,
        items: [...phase10Spec.items, { id: 'river_pillar_slab', displayName: 'Clash', maxCount: 64 }]
      })
    ).toThrow(/collides/)
    expect(() =>
      parseProjectSpec({
        ...phase10Spec,
        worldgen: [{ ...phase10Spec.worldgen[0], block: 'minecraft:milk' }]
      })
    ).toThrow(/not allowlisted/)
  })

  it('keeps string goals compatible and honors object priorities', () => {
    expect(resolveMobGoals({ preset: 'hostile_melee', goals: [] })).toEqual([{ id: 'melee', priority: 2 }])
    expect(resolveMobGoals({ preset: 'hostile_melee', goals: [{ id: 'leap', priority: 1 }, { id: 'melee', priority: 3 }] })).toEqual([
      { id: 'leap', priority: 1 },
      { id: 'melee', priority: 3 }
    ])
    expect(resolveMobGoals({ preset: 'hostile_melee', goals: ['wander'] })).toEqual([{ id: 'wander', priority: 1 }])
  })

  it('emits Fabric pillar/slab/stairs, spring, config, priorities, and follow range', () => {
    const files = planFabricFiles(manifestFor('fabric', '1.21.1'), phase10Spec)
    const main = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(main).toContain('CraftStudioConfig.load()')
    expect(main).toContain('if (CraftStudioConfig.enableWorldgen)')
    expect(main).toContain('FLUID_SPRINGS')
    expect(main).toContain('import net.minecraft.block.PillarBlock')
    expect(main).toContain('import net.minecraft.block.SlabBlock')
    expect(main).toContain('import net.minecraft.block.StairsBlock')
    expect(main).toContain('new PillarBlock')
    expect(main).toContain('new SlabBlock')
    expect(main).toContain('new StairsBlock')
    expect(main).toContain('RIVER_PILLAR_SLAB_BLOCK')
    expect(main).toContain('RIVER_PILLAR_STAIRS_BLOCK')
    expect(main).toContain('spawnWeightScale')

    const config = files.find((file) => file.relativePath.endsWith('CraftStudioConfig.java'))?.contents.toString() ?? ''
    expect(config).toContain('enableWorldgen')
    expect(config).toContain('enableChestLoot')
    expect(config).toContain('FabricLoader')
    expect(files.some((file) => file.relativePath === 'CONFIG.md')).toBe(true)
    expect(files.some((file) => file.relativePath === 'river_stones.config.json')).toBe(true)

    const pillarState = files.find((file) => file.relativePath.endsWith('blockstates/river_pillar.json'))?.contents.toString() ?? ''
    expect(pillarState).toContain('axis=y')
    expect(pillarState).toContain('axis=x')
    const slabState = files.find((file) => file.relativePath.endsWith('blockstates/river_pillar_slab.json'))?.contents.toString() ?? ''
    expect(slabState).toContain('type=bottom')
    const stairsState = files.find((file) => file.relativePath.endsWith('blockstates/river_pillar_stairs.json'))?.contents.toString() ?? ''
    expect(stairsState).toContain('facing=east,half=bottom,shape=straight')
    const spring = files.find((file) => file.relativePath.endsWith('configured_feature/stone_spring.json'))?.contents.toString() ?? ''
    expect(spring).toContain('minecraft:spring_feature')
    expect(spring).toContain('minecraft:water')

    const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
    expect(entity).toContain('this.goalSelector.add(1, new PounceAtTargetGoal')
    expect(entity).toContain('this.goalSelector.add(3, new MeleeAttackGoal')
    expect(entity).toContain('GENERIC_FOLLOW_RANGE')
    expect(entity).toContain('24d')
    expect(entity).toContain('ActiveTargetGoal<>(this, PlayerEntity.class')
    expect(entity).toContain('ActiveTargetGoal<>(this, HostileEntity.class')

    const loot = main
    expect(loot).toContain('CraftStudioConfig.enableChestLoot')
  })

  it('emits Forge/NeoForge pillar variants, spring biome modifiers, config, and follow range', () => {
    const forge = planForgeFiles(manifestFor('forge', '1.21.1'), phase10Spec)
    const neo = planNeoForgeFiles(manifestFor('neoforge', '1.21.1'), phase10Spec)
    for (const files of [forge, neo]) {
      const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
      expect(java).toContain('CraftStudioConfig.load()')
      expect(java).toContain('RotatedPillarBlock')
      expect(java).toContain('SlabBlock')
      expect(java).toContain('StairBlock')
      expect(files.some((file) => file.relativePath.includes('biome_modifier/stone_spring_spring.json'))).toBe(true)
      const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
      expect(entity).toContain('FOLLOW_RANGE')
      expect(entity).toContain('24d')
      expect(entity).toContain('addGoal(1, new LeapAtTargetGoal')
      expect(entity).toContain('addGoal(3, new MeleeAttackGoal')
      expect(entity).toContain('NearestAttackableTargetGoal<>(this, Player.class')
      expect(entity).toContain('NearestAttackableTargetGoal<>(this, Monster.class')
      const glm = files.find((file) => file.relativePath.endsWith('AddBonusChestModifier.java'))?.contents.toString() ?? ''
      expect(glm).toContain('CraftStudioConfig.enableChestLoot')
    }
    const forgeSpring = forge.find((file) => file.relativePath.includes('forge/biome_modifier/stone_spring_spring.json'))
      ?.contents.toString() ?? ''
    expect(forgeSpring).toContain('fluid_springs')
    const spawn = forge.find((file) => file.relativePath.includes('biome_modifier/stone_mite_spawns.json'))?.contents.toString() ?? ''
    expect(spawn).toContain('"weight": 16')
  })

  it('omits Forge biome modifiers when worldgen is disabled at apply time', () => {
    const disabled = parseProjectSpec({ ...phase10Spec, config: { ...phase10Spec.config, enableWorldgen: false } })
    const forge = planForgeFiles(manifestFor('forge', '1.21.1'), disabled)
    expect(forge.some((file) => file.relativePath.includes('stone_spring_spring.json'))).toBe(false)
    expect(forge.some((file) => file.relativePath.endsWith('configured_feature/stone_spring.json'))).toBe(true)
  })

  it('exports a standalone datapack without Java or loader biome hooks', () => {
    const files = planStandaloneDatapack(phase10Spec, '1.21.1')
    expect(files.some((file) => file.relativePath === 'pack.mcmeta')).toBe(true)
    expect(files.some((file) => file.relativePath === 'DATAPACK.md')).toBe(true)
    const meta = files.find((file) => file.relativePath === 'pack.mcmeta')?.contents.toString() ?? ''
    expect(meta).toContain('"pack_format": 48')
    expect(files.some((file) => file.relativePath.endsWith('worldgen/configured_feature/stone_spring.json'))).toBe(true)
    expect(files.some((file) => file.relativePath.endsWith('loot_table/blocks/river_pillar.json'))).toBe(true)
    expect(files.some((file) => file.relativePath.endsWith('.java'))).toBe(false)
    expect(files.some((file) => file.relativePath.includes('biome_modifier'))).toBe(false)
    const doc = files.find((file) => file.relativePath === 'DATAPACK.md')?.contents.toString() ?? ''
    expect(doc).toContain('not** include Java')
  })

  it('formats an exportable evidence summary without inventing Tested', () => {
    const text = formatEvidenceSummary([], { appVersion: '0.10.0', generatedAt: '2026-09-18T05:00:00.000Z' })
    expect(text).toContain('No runtime evidence')
    expect(text).toContain('Experimental')
    expect(text).not.toContain('status: Tested')
  })

  it('infers pillar/slab/stairs and spring on mods', () => {
    const spec = inferSpecFromPrompt(
      manifestFor('fabric', '1.21.1'),
      'Add a pillar stone block with slabs and stairs plus a water spring'
    )
    expect(spec.blocks[0]?.shape).toBe('pillar')
    expect(spec.blocks[0]?.slab).toBe(true)
    expect(spec.blocks[0]?.stairs).toBe(true)
    expect(spec.worldgen.some((entry) => entry.kind === 'spring')).toBe(true)
  })
})
