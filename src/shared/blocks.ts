export const BLOCK_MATERIALS = ['stone', 'wood', 'dirt', 'metal', 'glass', 'gravel'] as const
export type BlockMaterial = (typeof BLOCK_MATERIALS)[number]

export const BLOCK_SHAPES = ['cube_all', 'pillar'] as const
export type BlockShape = (typeof BLOCK_SHAPES)[number]

export const BLOCK_ENTRY_CAP = 4

export const BLOCK_MATERIAL_LABELS: Record<BlockMaterial, string> = {
  stone: 'Stone (sound + strength preset)',
  wood: 'Wood',
  dirt: 'Dirt / soil',
  metal: 'Metal',
  glass: 'Glass',
  gravel: 'Gravel'
}

export function yarnBlockSound(material: BlockMaterial): string {
  const names: Record<BlockMaterial, string> = {
    stone: 'STONE',
    wood: 'WOOD',
    dirt: 'GRAVEL',
    metal: 'METAL',
    glass: 'GLASS',
    gravel: 'GRAVEL'
  }
  return names[material]
}

export function mojangBlockSound(material: BlockMaterial): string {
  return yarnBlockSound(material)
}

export interface BlockDefaults {
  id: string
  displayName: string
  material: BlockMaterial
  hardness: number
  resistance: number
  dropItem: string
  shape: BlockShape
  slab: boolean
  stairs: boolean
}

export const DEFAULT_BLOCK: BlockDefaults = {
  id: 'river_stone',
  displayName: 'River Stone',
  material: 'stone',
  hardness: 1.5,
  resistance: 6,
  dropItem: 'self',
  shape: 'cube_all',
  slab: false,
  stairs: false
}

export function defaultBlock(id = DEFAULT_BLOCK.id): BlockDefaults {
  return { ...DEFAULT_BLOCK, id }
}

export function slabId(blockId: string): string {
  return `${blockId}_slab`.slice(0, 31)
}

export function stairsId(blockId: string): string {
  return `${blockId}_stairs`.slice(0, 31)
}

export function derivedBlockIds(block: { id: string; slab?: boolean; stairs?: boolean }): string[] {
  const ids: string[] = []
  if (block.slab) {
    ids.push(slabId(block.id))
  }
  if (block.stairs) {
    ids.push(stairsId(block.id))
  }
  return ids
}
