export const SPAWN_BIOMES = [
  'plains',
  'forest',
  'desert',
  'taiga',
  'savanna',
  'jungle',
  'swamp',
  'snowy_plains'
] as const

export type SpawnBiome = (typeof SPAWN_BIOMES)[number]

export interface MobSpawnTable {
  enabled: boolean
  biomes: SpawnBiome[]
  weight: number
  minGroup: number
  maxGroup: number
}

export const DEFAULT_MOB_SPAWN: MobSpawnTable = {
  enabled: false,
  biomes: [],
  weight: 8,
  minGroup: 1,
  maxGroup: 2
}

export function yarnBiomeKey(biome: SpawnBiome): string {
  return biome.toUpperCase()
}

export function minecraftBiomeId(biome: SpawnBiome): string {
  return `minecraft:${biome}`
}

export function defaultCommandPermission(modId: string, commandName: string): string {
  return `${modId}.command.${commandName}`
}

export function defaultMenuPermission(modId: string, guiId: string): string {
  return `${modId}.menu.${guiId}`
}
