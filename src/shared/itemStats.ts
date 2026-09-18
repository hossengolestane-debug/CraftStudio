export const ITEM_ATTRIBUTES = [
  'attack_damage',
  'attack_speed',
  'armor',
  'max_health',
  'movement_speed'
] as const

export type ItemAttributeId = (typeof ITEM_ATTRIBUTES)[number]

export const ITEM_ATTRIBUTE_SLOTS = ['mainhand', 'offhand', 'any'] as const
export type ItemAttributeSlot = (typeof ITEM_ATTRIBUTE_SLOTS)[number]

export const ITEM_ATTRIBUTE_CAP = 4

export function yarnAttributeName(id: ItemAttributeId, classic: boolean): string {
  if (classic) {
    const classicNames: Record<ItemAttributeId, string> = {
      attack_damage: 'GENERIC_ATTACK_DAMAGE',
      attack_speed: 'GENERIC_ATTACK_SPEED',
      armor: 'GENERIC_ARMOR',
      max_health: 'GENERIC_MAX_HEALTH',
      movement_speed: 'GENERIC_MOVEMENT_SPEED'
    }
    return classicNames[id]
  }
  const modernNames: Record<ItemAttributeId, string> = {
    attack_damage: 'ATTACK_DAMAGE',
    attack_speed: 'ATTACK_SPEED',
    armor: 'ARMOR',
    max_health: 'MAX_HEALTH',
    movement_speed: 'MOVEMENT_SPEED'
  }
  return modernNames[id]
}

export function mojangAttributeName(id: ItemAttributeId): string {
  const names: Record<ItemAttributeId, string> = {
    attack_damage: 'ATTACK_DAMAGE',
    attack_speed: 'ATTACK_SPEED',
    armor: 'ARMOR',
    max_health: 'MAX_HEALTH',
    movement_speed: 'MOVEMENT_SPEED'
  }
  return names[id]
}

export function yarnAttributeSlot(slot: ItemAttributeSlot): string {
  if (slot === 'offhand') {
    return 'OFFHAND'
  }
  if (slot === 'any') {
    return 'ANY'
  }
  return 'MAINHAND'
}

export function mojangEquipmentGroup(slot: ItemAttributeSlot): string {
  if (slot === 'offhand') {
    return 'OFFHAND'
  }
  if (slot === 'any') {
    return 'ANY'
  }
  return 'MAINHAND'
}

export function vanillaItemConstant(id: string): string {
  return id.replace(/^minecraft:/, '').toUpperCase()
}
