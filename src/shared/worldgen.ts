import { SPAWN_BIOMES, type SpawnBiome } from './spawn'

export const WORLDGEN_BLOCKS = [
  'minecraft:coal_ore',
  'minecraft:iron_ore',
  'minecraft:copper_ore',
  'minecraft:gold_ore',
  'minecraft:redstone_ore',
  'minecraft:lapis_ore',
  'minecraft:diamond_ore',
  'minecraft:emerald_ore'
] as const

export type WorldgenVanillaOre = (typeof WORLDGEN_BLOCKS)[number]

export const SURFACE_PATCH_BLOCKS = [
  'minecraft:dandelion',
  'minecraft:poppy',
  'minecraft:short_grass',
  'minecraft:fern',
  'minecraft:dead_bush'
] as const

export type SurfacePatchBlock = (typeof SURFACE_PATCH_BLOCKS)[number]

export const SPRING_FLUIDS = ['minecraft:water', 'minecraft:lava'] as const
export type SpringFluid = (typeof SPRING_FLUIDS)[number]

export const WORLDGEN_KINDS = ['ore_vein', 'surface_patch', 'spring'] as const
export type WorldgenKind = (typeof WORLDGEN_KINDS)[number]
export const WORLDGEN_KIND = 'ore_vein' as const
export const WORLDGEN_ENTRY_CAP = 4

export const DEEPSLATE_ORE: Record<WorldgenVanillaOre, string> = {
  'minecraft:coal_ore': 'minecraft:deepslate_coal_ore',
  'minecraft:iron_ore': 'minecraft:deepslate_iron_ore',
  'minecraft:copper_ore': 'minecraft:deepslate_copper_ore',
  'minecraft:gold_ore': 'minecraft:deepslate_gold_ore',
  'minecraft:redstone_ore': 'minecraft:deepslate_redstone_ore',
  'minecraft:lapis_ore': 'minecraft:deepslate_lapis_ore',
  'minecraft:diamond_ore': 'minecraft:deepslate_diamond_ore',
  'minecraft:emerald_ore': 'minecraft:deepslate_emerald_ore'
}

export function isVanillaOre(block: string): block is WorldgenVanillaOre {
  return (WORLDGEN_BLOCKS as readonly string[]).includes(block)
}

export function isSurfacePatchPlant(block: string): block is SurfacePatchBlock {
  return (SURFACE_PATCH_BLOCKS as readonly string[]).includes(block)
}

export function isSpringFluid(block: string): block is SpringFluid {
  return (SPRING_FLUIDS as readonly string[]).includes(block)
}

export interface WorldgenDefaults {
  id: string
  kind: WorldgenKind
  block: string
  size: number
  count: number
  minY: number
  maxY: number
  biomes: SpawnBiome[]
}

export const DEFAULT_WORLDGEN: WorldgenDefaults = {
  id: 'iron_vein',
  kind: 'ore_vein',
  block: 'minecraft:iron_ore',
  size: 9,
  count: 10,
  minY: -24,
  maxY: 56,
  biomes: ['plains']
}

export const DEFAULT_SURFACE_PATCH: WorldgenDefaults = {
  id: 'flower_patch',
  kind: 'surface_patch',
  block: 'minecraft:dandelion',
  size: 12,
  count: 8,
  minY: 0,
  maxY: 320,
  biomes: ['plains']
}

export const DEFAULT_SPRING: WorldgenDefaults = {
  id: 'stone_spring',
  kind: 'spring',
  block: 'minecraft:water',
  size: 4,
  count: 8,
  minY: -24,
  maxY: 64,
  biomes: ['plains']
}

export function defaultWorldgen(id = DEFAULT_WORLDGEN.id): WorldgenDefaults {
  return { ...DEFAULT_WORLDGEN, id, biomes: [...DEFAULT_WORLDGEN.biomes] }
}

export function defaultSurfacePatch(id = DEFAULT_SURFACE_PATCH.id): WorldgenDefaults {
  return { ...DEFAULT_SURFACE_PATCH, id, biomes: [...DEFAULT_SURFACE_PATCH.biomes] }
}

export function defaultSpring(id = DEFAULT_SPRING.id): WorldgenDefaults {
  return { ...DEFAULT_SPRING, id, biomes: [...DEFAULT_SPRING.biomes] }
}

export function worldgenBiomesOrAllowlist(biomes: readonly SpawnBiome[]): SpawnBiome[] {
  return biomes.length > 0 ? [...biomes] : [...SPAWN_BIOMES]
}

export function resolveWorldgenBlockId(modId: string, block: string, specBlockIds: readonly string[]): string {
  if (block.startsWith('minecraft:')) {
    return block
  }
  const bare = block.includes(':') ? block.slice(block.indexOf(':') + 1) : block
  if (specBlockIds.includes(bare) || specBlockIds.includes(block)) {
    return `${modId}:${bare}`
  }
  return block
}

export function deepslateCounterpart(block: string, resolved: string): string {
  if (isVanillaOre(block)) {
    return DEEPSLATE_ORE[block]
  }
  return resolved
}
