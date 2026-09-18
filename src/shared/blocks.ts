export const BLOCK_MATERIALS = ['stone', 'wood', 'dirt', 'metal', 'glass', 'gravel'] as const
export type BlockMaterial = (typeof BLOCK_MATERIALS)[number]

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
}

export const DEFAULT_BLOCK: BlockDefaults = {
  id: 'river_stone',
  displayName: 'River Stone',
  material: 'stone',
  hardness: 1.5,
  resistance: 6,
  dropItem: 'self'
}

export function defaultBlock(id = DEFAULT_BLOCK.id): BlockDefaults {
  return { ...DEFAULT_BLOCK, id }
}
