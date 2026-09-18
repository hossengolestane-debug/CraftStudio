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

export type WorldgenBlock = (typeof WORLDGEN_BLOCKS)[number]

export const WORLDGEN_KIND = 'ore_vein' as const
export const WORLDGEN_ENTRY_CAP = 4

export const DEEPSLATE_ORE: Record<WorldgenBlock, string> = {
  'minecraft:coal_ore': 'minecraft:deepslate_coal_ore',
  'minecraft:iron_ore': 'minecraft:deepslate_iron_ore',
  'minecraft:copper_ore': 'minecraft:deepslate_copper_ore',
  'minecraft:gold_ore': 'minecraft:deepslate_gold_ore',
  'minecraft:redstone_ore': 'minecraft:deepslate_redstone_ore',
  'minecraft:lapis_ore': 'minecraft:deepslate_lapis_ore',
  'minecraft:diamond_ore': 'minecraft:deepslate_diamond_ore',
  'minecraft:emerald_ore': 'minecraft:deepslate_emerald_ore'
}

export interface WorldgenDefaults {
  id: string
  kind: typeof WORLDGEN_KIND
  block: WorldgenBlock
  size: number
  count: number
  minY: number
  maxY: number
  biomes: SpawnBiome[]
}

export const DEFAULT_WORLDGEN: WorldgenDefaults = {
  id: 'iron_vein',
  kind: WORLDGEN_KIND,
  block: 'minecraft:iron_ore',
  size: 9,
  count: 10,
  minY: -24,
  maxY: 56,
  biomes: ['plains']
}

export function defaultWorldgen(id = DEFAULT_WORLDGEN.id): WorldgenDefaults {
  return { ...DEFAULT_WORLDGEN, id, biomes: [...DEFAULT_WORLDGEN.biomes] }
}

export function worldgenBiomesOrAllowlist(biomes: readonly SpawnBiome[]): SpawnBiome[] {
  return biomes.length > 0 ? [...biomes] : [...SPAWN_BIOMES]
}
