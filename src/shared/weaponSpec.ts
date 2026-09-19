import { z } from 'zod'
import {
  HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS,
  MACE_EXCLUSIVE_GROUPS,
  TERRAIN_ALLOW_BLOCKS,
  compatibleEnchantmentsFor,
  enchantmentMaxLevel,
  isCompatibleEnchantment,
  normalizeVanillaId
} from './vanillaRegistry'

export const WEAPON_TEXTURE_STYLES = ['none', 'netherite_mace', 'generic_weapon'] as const
export type WeaponTextureStyle = (typeof WEAPON_TEXTURE_STYLES)[number]

export const weaponEnchantmentSchema = z.object({
  id: z.string().trim().min(3).max(64),
  level: z.number().int().min(1).max(5)
})

export const lifeStealSchema = z.object({
  enabled: z.boolean().default(false),
  percent: z.number().min(0).max(1).default(0.2),
  capHealth: z.number().min(0).max(20).default(4),
  hostileOnly: z.boolean().default(true)
})

export const shockwaveSchema = z.object({
  enabled: z.boolean().default(false),
  minFallBlocks: z.number().min(0).max(64).default(3),
  cooldownSeconds: z.number().min(0).max(120).default(10),
  radius: z.number().min(0).max(16).default(6),
  damage: z.number().min(0).max(40).default(8),
  upwardImpulse: z.number().min(0).max(4).default(1)
})

export const terrainEffectSchema = z.object({
  enabled: z.boolean().default(false),
  radius: z.number().int().min(0).max(8).default(3),
  maxBlocks: z.number().int().min(0).max(64).default(24),
  allowBlocks: z.array(z.string().trim().min(3).max(64)).max(16).default([...TERRAIN_ALLOW_BLOCKS])
})

export const itemWeaponSchema = z.object({
  smash: z.boolean().default(false),
  enchantments: z.array(weaponEnchantmentSchema).max(8).default([]),
  lifeSteal: lifeStealSchema.optional(),
  shockwave: shockwaveSchema.optional(),
  terrain: terrainEffectSchema.optional(),
  textureStyle: z.enum(WEAPON_TEXTURE_STYLES).default('none')
})

export type SpecWeapon = z.infer<typeof itemWeaponSchema>
export type SpecWeaponEnchantment = z.infer<typeof weaponEnchantmentSchema>
export type SpecLifeSteal = z.infer<typeof lifeStealSchema>
export type SpecShockwave = z.infer<typeof shockwaveSchema>
export type SpecTerrainEffect = z.infer<typeof terrainEffectSchema>

export function defaultWeapon(): SpecWeapon {
  return {
    smash: false,
    enchantments: [],
    textureStyle: 'none'
  }
}

export function hasWeaponBehavior(weapon: SpecWeapon | undefined | null): boolean {
  if (!weapon) {
    return false
  }
  return (
    weapon.smash ||
    weapon.enchantments.length > 0 ||
    weapon.lifeSteal?.enabled === true ||
    weapon.shockwave?.enabled === true ||
    weapon.terrain?.enabled === true ||
    weapon.textureStyle !== 'none'
  )
}

export function weaponKind(weapon: SpecWeapon | undefined | null): 'mace' | 'generic' {
  return weapon?.smash ? 'mace' : 'generic'
}

const CREATE_MOB =
  /\b(custom mob|new mob|add (a |an )?(hostile |passive |neutral )?(mob|creature|entity)|create (a |an )?(hostile |passive |neutral )?(mob|creature|entity)|entity type|summonable (mob|entity))\b/i
const MOB_FILTER_ONLY =
  /\b(affects?|against|versus|vs\.?|filter|excluding|eligible|other|only)\s+(all\s+)?(hostile\s+)?mobs?\b/i
const HOSTILE_FILTER = /\bhostile mobs?\b/i

function stripMobNegations(text: string): string {
  return text.replace(
    /\b(do not|don't|never|without)\b[^.!?\n]{0,80}\b(custom mob|new mob|mob|entity|creature)\b/gi,
    ' '
  )
}

export function promptRequestsCustomMob(text: string): boolean {
  const positive = stripMobNegations(text)
  if (CREATE_MOB.test(positive)) {
    return true
  }
  if (MOB_FILTER_ONLY.test(text) || HOSTILE_FILTER.test(text)) {
    return false
  }
  return /\b(mob|entity|entities|creature)\b/i.test(positive)
}

export function promptRequestsChestLoot(text: string): boolean {
  if (
    /\b(chest loot|bonus chest|dungeon chest)\b[^.!?\n]{0,40}\b(disabled|off|false)\b/i.test(text) ||
    /\b(disabled|off|without|do not|don't|never)\b[^.!?\n]{0,40}\b(chest loot|bonus chest)\b/i.test(text)
  ) {
    return false
  }
  return /\b(chest loot|dungeon chest|loot inject|found in chests|bonus chest|village chest|inject(?:ed)? into chests)\b/i.test(
    text
  )
}

export function promptRequestsWorldgen(text: string): boolean {
  return /\b(ore|vein|ore gen|worldgen|surface patch|flower patch|water spring|lava spring|geyser)\b/i.test(text)
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 } as const

function parseLevelToken(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined
  }
  if (/^[1-5]$/.test(raw)) {
    return Number(raw)
  }
  const roman = ROMAN[raw.toLowerCase() as keyof typeof ROMAN]
  return roman
}

function parseEnchantmentMentions(text: string, kind: 'mace' | 'generic'): SpecWeaponEnchantment[] {
  const allowed = compatibleEnchantmentsFor(kind)
  const found: SpecWeaponEnchantment[] = []
  for (const id of allowed) {
    const bare = id.replace('minecraft:', '').replace(/_/g, '[\\s_]+')
    const match = text.match(
      new RegExp(`\\b${bare}\\b(?:\\s+(?:level\\s+)?([1-5]|I{1,3}|IV|V))?`, 'i')
    )
    if (match) {
      const parsed = parseLevelToken(match[1])
      found.push({ id, level: parsed ?? 1 })
    }
  }
  return found.slice(0, 8)
}

export function promptRequestsCustomTexture(text: string): boolean {
  return (
    /\b(32\s*[×x]\s*32|custom texture|netherite handle|purple cracks|golden core|item texture|item-model|texture style)\b/i.test(
      text
    ) || /\b(png|hand-painted|import(?:ed)? texture)\b/i.test(text)
  )
}

export function promptRequestsMaceEnchantments(text: string): boolean {
  if (/\b(compatible mace enchantments|enchant the crafted item|mace enchantments)\b/i.test(text)) {
    return true
  }
  return (
    /\b(mace|smash)\b/i.test(text) &&
    /\b(enchant(?:ments?)?|density|breach|wind[_\s-]?burst|fire[_\s-]?aspect)\b/i.test(text)
  )
}

function dropExclusiveConflicts(
  enchantments: SpecWeaponEnchantment[],
  kind: 'mace' | 'generic'
): SpecWeaponEnchantment[] {
  const preferred = kind === 'mace' ? 'minecraft:density' : 'minecraft:sharpness'
  const kept: SpecWeaponEnchantment[] = []
  const usedGroups = new Set<number>()
  const ordered = [...enchantments].sort((left, right) => {
    if (left.id === preferred) {
      return -1
    }
    if (right.id === preferred) {
      return 1
    }
    return 0
  })
  for (const entry of ordered) {
    const id = normalizeVanillaId(entry.id)
    const groupIndex = MACE_EXCLUSIVE_GROUPS.findIndex((group) => group.includes(id))
    if (kind === 'mace' && groupIndex >= 0) {
      if (usedGroups.has(groupIndex)) {
        continue
      }
      usedGroups.add(groupIndex)
    }
    kept.push({ id, level: Math.min(enchantmentMaxLevel(id), Math.max(1, entry.level)) })
  }
  return kept
}

export function fillHighestCompatibleEnchantments(
  kind: 'mace' | 'generic',
  mentioned: SpecWeaponEnchantment[],
  prompt: string
): SpecWeaponEnchantment[] {
  const { kept } = filterCompatibleEnchantments(mentioned, kind)
  const resolved = dropExclusiveConflicts(kept, kind)
  if (kind !== 'mace' || !promptRequestsMaceEnchantments(prompt)) {
    return resolved.slice(0, 8)
  }
  const byId = new Map(resolved.map((entry) => [entry.id, entry]))
  for (const entry of HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS) {
    byId.set(entry.id, { id: entry.id, level: entry.level })
  }
  const ordered = HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS.map((entry) => byId.get(entry.id)!).filter(Boolean)
  for (const entry of byId.values()) {
    if (!ordered.some((item) => item.id === entry.id)) {
      ordered.push(entry)
    }
  }
  return dropExclusiveConflicts(ordered, kind).slice(0, 8)
}

export function reportedMaceEnchantmentsComplete(input: {
  items: { weapon?: { enchantments?: { id: string; level: number }[] } }[]
}): boolean {
  const listed = input.items.flatMap((item) => item.weapon?.enchantments ?? [])
  return HIGHEST_COMPATIBLE_MACE_ENCHANTMENTS.every((required) =>
    listed.some((entry) => normalizeVanillaId(entry.id) === required.id && entry.level === required.level)
  )
}

export function mergeWeapons(
  existing: SpecWeapon | undefined,
  inferred: SpecWeapon | undefined,
  prompt: string
): SpecWeapon | undefined {
  if (!existing && !inferred) {
    return undefined
  }
  const smash = Boolean(existing?.smash || inferred?.smash)
  const kind = smash ? 'mace' : 'generic'
  const textureStyle =
    existing?.textureStyle && existing.textureStyle !== 'none'
      ? existing.textureStyle
      : inferred?.textureStyle && inferred.textureStyle !== 'none'
        ? inferred.textureStyle
        : promptRequestsCustomTexture(prompt) || smash
          ? smash || /\bnetherite\b/i.test(prompt)
            ? 'netherite_mace'
            : 'generic_weapon'
          : 'none'
  const enchantments = fillHighestCompatibleEnchantments(
    kind,
    [...(existing?.enchantments ?? []), ...(inferred?.enchantments ?? [])],
    prompt
  )
  const weapon: SpecWeapon = {
    smash,
    enchantments,
    textureStyle,
    lifeSteal: existing?.lifeSteal?.enabled ? existing.lifeSteal : inferred?.lifeSteal,
    shockwave: existing?.shockwave?.enabled ? existing.shockwave : inferred?.shockwave,
    terrain: existing?.terrain?.enabled ? existing.terrain : inferred?.terrain
  }
  return weapon
}

function numberAfter(text: string, pattern: RegExp, fallback: number): number {
  const match = text.match(pattern)
  if (!match?.[1]) {
    return fallback
  }
  const value = Number(match[1])
  return Number.isFinite(value) ? value : fallback
}

export function inferWeaponFromPrompt(text: string): SpecWeapon | undefined {
  const smash = /\b(mace|smash attack|smash)\b/i.test(text)
  const lifeSteal = /\b(life ?steal|lifesteal|leech health)\b/i.test(text)
  const shockwave = /\b(shockwave|quake|area damage|aoe)\b/i.test(text)
  const terrain = /\b(terrain|break blocks|terrain smash|destroy (dirt|grass|stone|sand|gravel|blocks))\b/i.test(text)
  const texture =
    /\b(32\s*[×x]\s*32|custom texture|netherite handle|purple cracks|golden core)\b/i.test(text) || smash
  if (!smash && !lifeSteal && !shockwave && !terrain && !texture) {
    return undefined
  }
  const kind = smash ? 'mace' : 'generic'
  const enchantments = fillHighestCompatibleEnchantments(kind, parseEnchantmentMentions(text, kind), text)
  const wantsTexture = texture || promptRequestsCustomTexture(text)
  const weapon: SpecWeapon = {
    smash,
    enchantments,
    textureStyle:
      smash || /\bnetherite\b/i.test(text) ? 'netherite_mace' : wantsTexture ? 'generic_weapon' : 'none'
  }
  if (lifeSteal) {
    weapon.lifeSteal = {
      enabled: true,
      percent: numberAfter(text, /(?:life ?steal|lifesteal)[^\n%]{0,40}?(\d{1,2})\s*%/i, 20) / 100,
      capHealth: numberAfter(text, /capped? (?:at )?(\d+(?:\.\d+)?)\s*(?:health|hp|heart)/i, 4),
      hostileOnly: !/\b(players?|passive mobs?)\b/i.test(text) || /\bhostile\b/i.test(text)
    }
    if (weapon.lifeSteal.percent > 1) {
      weapon.lifeSteal.percent = weapon.lifeSteal.percent / 100
    }
  }
  if (shockwave) {
    weapon.shockwave = {
      enabled: true,
      minFallBlocks: numberAfter(text, /(?:fall|fallen|falling)[^\n]{0,24}?(\d+(?:\.\d+)?)\s*blocks?/i, 3),
      cooldownSeconds: numberAfter(text, /cooldown[^\n]{0,20}?(\d+(?:\.\d+)?)\s*(?:seconds?|s)\b/i, 10),
      radius: numberAfter(text, /(?:shockwave|radius)[^\n]{0,24}?(\d+(?:\.\d+)?)\s*blocks?/i, 6),
      damage: numberAfter(text, /(?:shockwave[^\n]{0,40}|radius[^\n]{0,30})?(\d+(?:\.\d+)?)\s*damage/i, 8),
      upwardImpulse: numberAfter(text, /(?:upward )?impulse[^\n]{0,20}?(\d+(?:\.\d+)?)/i, 1)
    }
  }
  if (terrain) {
    weapon.terrain = {
      enabled: true,
      radius: numberAfter(text, /terrain[^\n]{0,30}?radius[^\n]{0,12}?(\d+)/i, 3),
      maxBlocks: numberAfter(text, /(?:max(?:imum)?|at most)\s+(\d+)\s+blocks?/i, 24),
      allowBlocks: [...TERRAIN_ALLOW_BLOCKS]
    }
  }
  return weapon
}

export function filterCompatibleEnchantments(
  enchantments: SpecWeaponEnchantment[],
  kind: 'mace' | 'generic'
): { kept: SpecWeaponEnchantment[]; rejected: SpecWeaponEnchantment[] } {
  const kept: SpecWeaponEnchantment[] = []
  const rejected: SpecWeaponEnchantment[] = []
  for (const entry of enchantments) {
    const id = normalizeVanillaId(entry.id)
    if (isCompatibleEnchantment(id, kind)) {
      kept.push({ id, level: entry.level })
    } else {
      rejected.push({ ...entry, id })
    }
  }
  return { kept, rejected }
}

export const OLLAMA_WEAPON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    smash: { type: 'boolean' },
    enchantments: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'level'],
        properties: {
          id: { type: 'string', minLength: 3, maxLength: 64 },
          level: { type: 'integer', minimum: 1, maximum: 5 }
        }
      }
    },
    lifeSteal: {
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        percent: { type: 'number', minimum: 0, maximum: 1 },
        capHealth: { type: 'number', minimum: 0, maximum: 20 },
        hostileOnly: { type: 'boolean' }
      }
    },
    shockwave: {
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        minFallBlocks: { type: 'number', minimum: 0, maximum: 64 },
        cooldownSeconds: { type: 'number', minimum: 0, maximum: 120 },
        radius: { type: 'number', minimum: 0, maximum: 16 },
        damage: { type: 'number', minimum: 0, maximum: 40 },
        upwardImpulse: { type: 'number', minimum: 0, maximum: 4 }
      }
    },
    terrain: {
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        radius: { type: 'integer', minimum: 0, maximum: 8 },
        maxBlocks: { type: 'integer', minimum: 0, maximum: 64 },
        allowBlocks: { type: 'array', maxItems: 16, items: { type: 'string' } }
      }
    },
    textureStyle: { type: 'string', enum: [...WEAPON_TEXTURE_STYLES] }
  }
} as const
