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

/** Documented unambiguous aliases → CraftStudio enum. Never invent a new gameplay attribute. */
const ATTRIBUTE_ALIASES: Record<string, ItemAttributeId> = {
  attack_damage: 'attack_damage',
  attackdamage: 'attack_damage',
  'attack damage': 'attack_damage',
  'generic.attack_damage': 'attack_damage',
  'generic.attackdamage': 'attack_damage',
  generic_attack_damage: 'attack_damage',
  genericattackdamage: 'attack_damage',
  generic_attackdamage: 'attack_damage',
  genericattack_damage: 'attack_damage',
  attack_speed: 'attack_speed',
  attackspeed: 'attack_speed',
  'attack speed': 'attack_speed',
  'generic.attack_speed': 'attack_speed',
  'generic.attackspeed': 'attack_speed',
  generic_attack_speed: 'attack_speed',
  armor: 'armor',
  'generic.armor': 'armor',
  generic_armor: 'armor',
  max_health: 'max_health',
  maxhealth: 'max_health',
  'max health': 'max_health',
  'generic.max_health': 'max_health',
  'generic.maxhealth': 'max_health',
  generic_max_health: 'max_health',
  movement_speed: 'movement_speed',
  movementspeed: 'movement_speed',
  'movement speed': 'movement_speed',
  'generic.movement_speed': 'movement_speed',
  'generic.movementspeed': 'movement_speed',
  generic_movement_speed: 'movement_speed'
}

export function normalizeAttributeId(raw: string): ItemAttributeId | null {
  const trimmed = raw.trim()
  if ((ITEM_ATTRIBUTES as readonly string[]).includes(trimmed)) {
    return trimmed as ItemAttributeId
  }
  const collapsed = trimmed.toLowerCase().replace(/generic_/g, 'generic.')
  const key = collapsed.replace(/[\s-]+/g, '_').replace(/__+/g, '_')
  if (ATTRIBUTE_ALIASES[key]) {
    return ATTRIBUTE_ALIASES[key]
  }
  const noGeneric = key.replace(/^generic\./, '').replace(/^generic/, '')
  if (ATTRIBUTE_ALIASES[noGeneric]) {
    return ATTRIBUTE_ALIASES[noGeneric]
  }
  const pascal = trimmed.replace(/generic\./i, '').replace(/^GENERIC_/, '')
  const fromPascal = pascal
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
  if (ATTRIBUTE_ALIASES[fromPascal] || (ITEM_ATTRIBUTES as readonly string[]).includes(fromPascal)) {
    return (ATTRIBUTE_ALIASES[fromPascal] ?? fromPascal) as ItemAttributeId
  }
  return null
}

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
