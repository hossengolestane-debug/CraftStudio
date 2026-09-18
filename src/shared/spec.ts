import { z } from 'zod'
import { AppError } from './errors'
import { BLOCK_ENTRY_CAP, BLOCK_MATERIALS, BLOCK_SHAPES, derivedBlockIds } from './blocks'
import { MOB_GOAL_CAP, MOB_GOALS, MOB_TARGETING, normalizeGoalEntry, type ResolvedMobGoal } from './goals'
import { ITEM_ATTRIBUTE_CAP, ITEM_ATTRIBUTE_SLOTS, ITEM_ATTRIBUTES } from './itemStats'
import { DEFAULT_MOB_SPAWN, SPAWN_BIOMES } from './spawn'
import { normalizeSpecDraft } from './specNormalize'
import { SPEC_FILENAME } from './types'
import {
  isSpringFluid,
  isSurfacePatchPlant,
  isVanillaOre,
  WORLDGEN_ENTRY_CAP,
  WORLDGEN_KINDS
} from './worldgen'

export { SPAWN_BIOMES }
export { ITEM_ATTRIBUTES, ITEM_ATTRIBUTE_SLOTS } from './itemStats'
export { WORLDGEN_BLOCKS, WORLDGEN_KINDS, SURFACE_PATCH_BLOCKS, SPRING_FLUIDS } from './worldgen'
export { BLOCK_MATERIALS, BLOCK_ENTRY_CAP, BLOCK_SHAPES, slabId, stairsId, derivedBlockIds } from './blocks'
export { MOB_GOALS, MOB_GOAL_CAP, MOB_TARGETING } from './goals'

export const SPEC_SCHEMA_VERSION = 1
export { SPEC_FILENAME }

export const VANILLA_ITEMS = [
  'minecraft:stick',
  'minecraft:cobblestone',
  'minecraft:stone',
  'minecraft:dirt',
  'minecraft:iron_ingot',
  'minecraft:gold_ingot',
  'minecraft:diamond',
  'minecraft:coal',
  'minecraft:oak_planks',
  'minecraft:string',
  'minecraft:leather',
  'minecraft:paper',
  'minecraft:glass',
  'minecraft:sand',
  'minecraft:gravel',
  'minecraft:wheat',
  'minecraft:egg',
  'minecraft:redstone',
  'minecraft:iron_nugget',
  'minecraft:gold_nugget',
  'minecraft:flint',
  'minecraft:bone',
  'minecraft:slime_ball',
  'minecraft:clay_ball',
  'minecraft:brick',
  'minecraft:charcoal',
  'minecraft:copper_ingot',
  'minecraft:amethyst_shard'
] as const

const ident = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{1,30}$/, 'Must be lowercase [a-z0-9_], start with a letter, 2–31 chars')

export const MOB_PRESETS = [
  'passive_wanderer',
  'hostile_melee',
  'neutral_flee',
  'avoid_players',
  'stationary_lookout',
  'follow_player',
  'leap_melee'
] as const
export const MOB_PRESET_CAP = MOB_PRESETS.length
export const MOB_MODELS = ['humanoid', 'quadruped', 'vanilla_disguise'] as const
export const VANILLA_MOB_BASES = ['minecraft:zombie', 'minecraft:pig', 'minecraft:wolf'] as const
export const ITEM_MODEL_STYLES = ['generated', 'handheld'] as const

const itemAttributeSchema = z.object({
  id: z.enum(ITEM_ATTRIBUTES),
  amount: z.number().min(-64).max(64),
  slot: z.enum(ITEM_ATTRIBUTE_SLOTS).default('mainhand')
})

const itemSchema = z.object({
  id: ident,
  displayName: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).default(''),
  maxCount: z.number().int().min(1).max(64).default(64),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic']).default('common'),
  modelStyle: z.enum(ITEM_MODEL_STYLES).default('generated'),
  layer1: z.boolean().default(false),
  durability: z.number().int().min(0).max(4096).default(0),
  attributes: z.array(itemAttributeSchema).max(ITEM_ATTRIBUTE_CAP).default([])
})

const mobDropSchema = z.object({
  itemId: z.string().trim().min(3).max(64),
  chance: z.number().min(0).max(1).default(1),
  min: z.number().int().min(1).max(64).default(1),
  max: z.number().int().min(1).max(64).default(1)
})

const mobSchema = z.object({
  id: ident,
  displayName: z.string().trim().min(1).max(80),
  health: z.number().min(1).max(200).default(20),
  movementSpeed: z.number().min(0.05).max(1).default(0.25),
  attackDamage: z.number().min(0).max(40).default(3),
  preset: z.enum(MOB_PRESETS).default('passive_wanderer'),
  targeting: z.enum(MOB_TARGETING).default('none'),
  followRange: z.number().min(4).max(64).default(16),
  spawnStub: z
    .string()
    .trim()
    .max(200)
    .default('Summon/command always works. Enable a biome spawn table for Fabric/Forge/NeoForge (not plugins).'),
  spawn: z
    .object({
      enabled: z.boolean().default(false),
      biomes: z.array(z.enum(SPAWN_BIOMES)).max(8).default([]),
      weight: z.number().int().min(1).max(100).default(8),
      minGroup: z.number().int().min(1).max(8).default(1),
      maxGroup: z.number().int().min(1).max(8).default(2)
    })
    .default(DEFAULT_MOB_SPAWN),
  drops: z.array(mobDropSchema).max(4).default([]),
  goals: z
    .array(
      z.union([
        z.enum(MOB_GOALS),
        z.object({
          id: z.enum(MOB_GOALS),
          priority: z.number().int().min(0).max(9).default(1)
        })
      ])
    )
    .max(MOB_GOAL_CAP)
    .default([]),
  appearance: z
    .object({
      model: z.enum(MOB_MODELS).default('humanoid'),
      vanillaBase: z.enum(VANILLA_MOB_BASES).default('minecraft:zombie')
    })
    .default({ model: 'humanoid', vanillaBase: 'minecraft:zombie' })
})

const modGuiWidgetSchema = z.object({
  id: ident,
  kind: z.enum(['label', 'button', 'slot']),
  x: z.number().int().min(0).max(400).default(8),
  y: z.number().int().min(0).max(400).default(8),
  width: z.number().int().min(8).max(400).default(80),
  height: z.number().int().min(8).max(80).default(16),
  text: z.string().trim().max(80).default(''),
  action: z.enum(['none', 'close', 'message']).default('none')
})

const dataSlotSchema = z.object({
  id: ident,
  initial: z.number().int().min(0).max(32767).default(0),
  ghostItemId: z.string().trim().max(64).optional()
})

const modGuiSchema = z.object({
  id: ident,
  title: z.string().trim().min(1).max(80),
  width: z.number().int().min(100).max(400).default(176),
  height: z.number().int().min(80).max(300).default(166),
  widgets: z.array(modGuiWidgetSchema).min(1).max(12),
  dataSlots: z.array(dataSlotSchema).max(4).default([])
})

const pluginGuiSlotSchema = z.object({
  index: z.number().int().min(0).max(53),
  iconKind: z.enum(['vanilla', 'mod']).default('vanilla'),
  iconId: z.string().trim().min(3).max(64).default('minecraft:paper'),
  label: z.string().trim().min(1).max(40),
  action: z.enum(['none', 'close', 'message', 'give']).default('none'),
  giveItemId: ident.optional(),
  permission: z.string().trim().max(80).optional()
})

const pluginGuiSchema = z.object({
  id: ident,
  title: z.string().trim().min(1).max(32),
  rows: z.number().int().min(1).max(6).default(3),
  pagination: z.boolean().default(false),
  slots: z.array(pluginGuiSlotSchema).min(1).max(54)
})

const recipeIngredientSchema = z.object({
  kind: z.enum(['vanilla', 'mod']),
  id: z.string().trim().min(3).max(64)
})

const recipeKeySchema = z.object({
  symbol: z.string().regex(/^[A-Z]$/, 'Shaped key must be a single A–Z letter'),
  kind: z.enum(['vanilla', 'mod']),
  id: z.string().trim().min(3).max(64)
})

const recipeSchema = z.object({
  id: ident,
  type: z.enum(['shapeless', 'shaped']),
  resultItemId: ident,
  resultCount: z.number().int().min(1).max(64).default(1),
  ingredients: z.array(recipeIngredientSchema).max(9).default([]),
  pattern: z.array(z.string().regex(/^[ A-Z#.]{1,3}$/)).max(3).default([]),
  keys: z.array(recipeKeySchema).max(9).default([])
})

const blockSchema = z.object({
  id: ident,
  displayName: z.string().trim().min(1).max(80),
  material: z.enum(BLOCK_MATERIALS).default('stone'),
  hardness: z.number().min(0.1).max(50).default(1.5),
  resistance: z.number().min(0).max(1200).default(6),
  dropItem: z.string().trim().min(1).max(64).default('self'),
  shape: z.enum(BLOCK_SHAPES).default('cube_all'),
  slab: z.boolean().default(false),
  stairs: z.boolean().default(false)
})

const configSchema = z.object({
  enableWorldgen: z.boolean().default(true),
  enableChestLoot: z.boolean().default(true),
  spawnWeightScale: z.number().min(0.25).max(4).default(1)
})

const worldgenSchema = z.object({
  id: ident,
  kind: z.enum(WORLDGEN_KINDS).default('ore_vein'),
  block: z.string().trim().min(3).max(64),
  size: z.number().int().min(1).max(16).default(9),
  count: z.number().int().min(1).max(32).default(10),
  minY: z.number().int().min(-64).max(320).default(-24),
  maxY: z.number().int().min(-64).max(320).default(56),
  biomes: z.array(z.enum(SPAWN_BIOMES)).max(8).default([])
})

const commandSchema = z.object({
  name: ident,
  description: z.string().trim().max(200).default(''),
  permission: z.string().trim().max(80).optional()
})

const unsupportedSchema = z.object({
  feature: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(400)
})

export const projectSpecSchema = z.object({
  schemaVersion: z.literal(SPEC_SCHEMA_VERSION),
  modId: ident,
  displayName: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).default(''),
  packageName: z
    .string()
    .trim()
    .regex(
      /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
      'Package must be a dotted Java package, e.g. local.craftstudio.my_mod'
    )
    .refine((value) => !value.split('.').some((part) => part === 'snap' || part.includes('..')), {
      message: 'Package segment is not allowed'
    }),
  mainClass: z.string().trim().regex(/^[A-Z][A-Za-z0-9]{0,47}$/, 'Main class must be PascalCase'),
  items: z.array(itemSchema).min(1).max(8),
  blocks: z.array(blockSchema).max(BLOCK_ENTRY_CAP).default([]),
  recipes: z.array(recipeSchema).max(8).default([]),
  commands: z.array(commandSchema).max(4).default([]),
  mobs: z.array(mobSchema).max(4).default([]),
  modGuis: z.array(modGuiSchema).max(4).default([]),
  pluginGuis: z.array(pluginGuiSchema).max(4).default([]),
  worldgen: z.array(worldgenSchema).max(WORLDGEN_ENTRY_CAP).default([]),
  config: configSchema.default({ enableWorldgen: true, enableChestLoot: true, spawnWeightScale: 1 }),
  unsupportedRequests: z.array(unsupportedSchema).max(16).default([]),
  source: z.enum(['template', 'ollama', 'merged', 'editor']),
  prompt: z.string().max(4000).default('')
})

export type ProjectSpec = z.infer<typeof projectSpecSchema>
export type SpecItem = z.infer<typeof itemSchema>
export type SpecRecipe = z.infer<typeof recipeSchema>
export type SpecMob = z.infer<typeof mobSchema>
export type SpecModGui = z.infer<typeof modGuiSchema>
export type SpecPluginGui = z.infer<typeof pluginGuiSchema>
export type SpecWorldgen = z.infer<typeof worldgenSchema>
export type SpecBlock = z.infer<typeof blockSchema>
export type SpecDataSlot = z.infer<typeof dataSlotSchema>
export type SpecItemAttribute = z.infer<typeof itemAttributeSchema>
export type SpecMobGoal = (typeof MOB_GOALS)[number]
export type SpecConfig = z.infer<typeof configSchema>
export type SpecResolvedGoal = ResolvedMobGoal

function jsonEnum(values: readonly string[]): { type: 'string'; enum: string[] } {
  return { type: 'string', enum: [...values] }
}

function jsonIdent(): Record<string, unknown> {
  return { type: 'string', pattern: '^[a-z][a-z0-9_]{1,30}$', minLength: 2, maxLength: 31 }
}

/** Ollama grammar fails on maxLength === 2000. Zod still allows 2000. */
function ollamaMaxLength(maxLength: number): number {
  return maxLength === 2000 ? 1999 : maxLength
}

function jsonString(options: { minLength?: number; maxLength?: number; pattern?: string } = {}): Record<string, unknown> {
  const out: Record<string, unknown> = { type: 'string' }
  if (options.minLength !== undefined) {
    out.minLength = options.minLength
  }
  if (options.maxLength !== undefined) {
    out.maxLength = ollamaMaxLength(options.maxLength)
  }
  if (options.pattern) {
    out.pattern = options.pattern
  }
  return out
}

function buildOllamaSpecJsonSchema(): Record<string, unknown> {
  const attributeItem = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'amount'],
    properties: {
      id: jsonEnum(ITEM_ATTRIBUTES),
      amount: { type: 'number', minimum: -64, maximum: 64 },
      slot: jsonEnum(ITEM_ATTRIBUTE_SLOTS)
    }
  }
  const ingredientItem = {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'id'],
    properties: {
      kind: jsonEnum(['vanilla', 'mod']),
      id: jsonString({ minLength: 3, maxLength: 64 })
    }
  }
  const recipeKey = {
    type: 'object',
    additionalProperties: false,
    required: ['symbol', 'kind', 'id'],
    properties: {
      symbol: { type: 'string', pattern: '^[A-Z]$' },
      kind: jsonEnum(['vanilla', 'mod']),
      id: jsonString({ minLength: 3, maxLength: 64 })
    }
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'modId', 'displayName', 'packageName', 'mainClass', 'items', 'source'],
    properties: {
      schemaVersion: { type: 'integer', const: SPEC_SCHEMA_VERSION },
      modId: jsonIdent(),
      displayName: jsonString({ minLength: 1, maxLength: 80 }),
      description: jsonString({ maxLength: 2000 }),
      packageName: { type: 'string' },
      mainClass: { type: 'string' },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'displayName'],
          properties: {
            id: jsonIdent(),
            displayName: jsonString({ minLength: 1, maxLength: 80 }),
            description: jsonString({ maxLength: 400 }),
            maxCount: { type: 'integer', minimum: 1, maximum: 64 },
            rarity: jsonEnum(['common', 'uncommon', 'rare', 'epic']),
            modelStyle: jsonEnum(ITEM_MODEL_STYLES),
            layer1: { type: 'boolean' },
            durability: { type: 'integer', minimum: 0, maximum: 4096 },
            attributes: { type: 'array', maxItems: ITEM_ATTRIBUTE_CAP, items: attributeItem }
          }
        }
      },
      blocks: {
        type: 'array',
        maxItems: BLOCK_ENTRY_CAP,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'displayName'],
          properties: {
            id: jsonIdent(),
            displayName: jsonString({ minLength: 1, maxLength: 80 }),
            material: jsonEnum(BLOCK_MATERIALS),
            hardness: { type: 'number' },
            resistance: { type: 'number' },
            dropItem: { type: 'string' },
            shape: jsonEnum(BLOCK_SHAPES),
            slab: { type: 'boolean' },
            stairs: { type: 'boolean' }
          }
        }
      },
      recipes: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'type', 'resultItemId'],
          properties: {
            id: jsonIdent(),
            type: jsonEnum(['shapeless', 'shaped']),
            resultItemId: jsonIdent(),
            resultCount: { type: 'integer', minimum: 1, maximum: 64 },
            ingredients: { type: 'array', maxItems: 9, items: ingredientItem },
            pattern: {
              type: 'array',
              maxItems: 3,
              items: { type: 'string', pattern: '^[ A-Z#.]{1,3}$' }
            },
            keys: { type: 'array', maxItems: 9, items: recipeKey }
          }
        }
      },
      commands: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: {
            name: jsonIdent(),
            description: jsonString({ maxLength: 200 }),
            permission: jsonString({ maxLength: 80 })
          }
        }
      },
      mobs: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'displayName'],
          properties: {
            id: jsonIdent(),
            displayName: { type: 'string' },
            health: { type: 'number' },
            movementSpeed: { type: 'number' },
            attackDamage: { type: 'number' },
            preset: jsonEnum(MOB_PRESETS),
            targeting: jsonEnum(MOB_TARGETING),
            goals: {
              type: 'array',
              maxItems: MOB_GOAL_CAP,
              items: {
                anyOf: [
                  jsonEnum(MOB_GOALS),
                  {
                    type: 'object',
                    required: ['id'],
                    properties: { id: jsonEnum(MOB_GOALS), priority: { type: 'integer' } }
                  }
                ]
              }
            }
          }
        }
      },
      modGuis: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title', 'widgets'],
          properties: {
            id: jsonIdent(),
            title: jsonString({ minLength: 1, maxLength: 80 }),
            width: { type: 'integer' },
            height: { type: 'integer' },
            widgets: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'kind'],
                properties: {
                  id: jsonIdent(),
                  kind: jsonEnum(['label', 'button', 'slot']),
                  text: jsonString({ maxLength: 80 }),
                  action: jsonEnum(['none', 'close', 'message'])
                }
              }
            },
            dataSlots: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id'],
                properties: {
                  id: jsonIdent(),
                  initial: { type: 'integer' },
                  ghostItemId: jsonString({ maxLength: 64 })
                }
              }
            }
          }
        }
      },
      pluginGuis: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title', 'slots'],
          properties: {
            id: jsonIdent(),
            title: jsonString({ minLength: 1, maxLength: 32 }),
            rows: { type: 'integer' },
            pagination: { type: 'boolean' },
            slots: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['index', 'label'],
                properties: {
                  index: { type: 'integer' },
                  iconKind: jsonEnum(['vanilla', 'mod']),
                  iconId: jsonString({ minLength: 3, maxLength: 64 }),
                  label: jsonString({ minLength: 1, maxLength: 40 }),
                  action: jsonEnum(['none', 'close', 'message', 'give'])
                }
              }
            }
          }
        }
      },
      worldgen: {
        type: 'array',
        maxItems: WORLDGEN_ENTRY_CAP,
        items: {
          type: 'object',
          required: ['id', 'block'],
          properties: {
            id: jsonIdent(),
            kind: jsonEnum(WORLDGEN_KINDS),
            block: { type: 'string' }
          }
        }
      },
      config: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enableWorldgen: { type: 'boolean' },
          enableChestLoot: { type: 'boolean' },
          spawnWeightScale: { type: 'number' }
        }
      },
      unsupportedRequests: {
        type: 'array',
        maxItems: 16,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['feature', 'reason'],
          properties: {
            feature: jsonString({ minLength: 1, maxLength: 80 }),
            reason: jsonString({ minLength: 1, maxLength: 400 })
          }
        }
      },
      source: jsonEnum(['template', 'ollama', 'merged', 'editor']),
      prompt: jsonString({ maxLength: 4000 })
    }
  }
}

export const OLLAMA_SPEC_JSON_SCHEMA = buildOllamaSpecJsonSchema()

export function specIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'spec'}: ${issue.message}`)
    .join('\n')
}

function noteOffAllowlistIngredients(draft: unknown): unknown {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return draft
  }
  const record = draft as Record<string, unknown>
  const unsupported = Array.isArray(record.unsupportedRequests)
    ? [...(record.unsupportedRequests as { feature: string; reason: string }[])]
    : []
  const recipes = Array.isArray(record.recipes) ? record.recipes : []
  for (const recipe of recipes) {
    if (!recipe || typeof recipe !== 'object') {
      continue
    }
    const rec = recipe as { id?: string; keys?: { id?: string; kind?: string }[]; ingredients?: { id?: string; kind?: string }[] }
    const recipeId = rec.id ?? 'recipe'
    const parts = [...(rec.keys ?? []), ...(rec.ingredients ?? [])]
    for (const part of parts) {
      const id = part.id ?? ''
      if (part.kind === 'vanilla' && id.startsWith('minecraft:') && !(VANILLA_ITEMS as readonly string[]).includes(id)) {
        const feature = `ingredient ${id}`
        if (!unsupported.some((item) => item.feature === feature)) {
          unsupported.push({
            feature,
            reason: `Recipe "${recipeId}" asked for ${id}. That id is not on the vanilla allowlist. It was not swapped for another item.`
          })
        }
      }
    }
  }
  return { ...record, unsupportedRequests: unsupported }
}

export function parseProjectSpec(input: unknown): ProjectSpec {
  const parsed = projectSpecSchema.safeParse(noteOffAllowlistIngredients(normalizeSpecDraft(input)))
  if (!parsed.success) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: 'The project specification is not valid.',
      action: 'Fix the highlighted fields or regenerate. Model output is never trusted until it passes this schema.',
      details: specIssues(parsed.error)
    })
  }

  const spec = parsed.data
  const itemIds = new Set(spec.items.map((item) => item.id))
  const blockIds = new Set(spec.blocks.map((block) => block.id))
  for (const block of spec.blocks) {
    for (const derived of derivedBlockIds(block)) {
      if (itemIds.has(derived) || blockIds.has(derived)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Block "${block.id}" variant "${derived}" collides with an existing id.`,
          action: 'Rename the parent block or disable slab/stairs.'
        })
      }
      blockIds.add(derived)
    }
  }

  for (const block of spec.blocks) {
    if (itemIds.has(block.id)) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Block "${block.id}" reuses an item id.`,
        action: 'Give the block a unique id. Block items occupy the same registry path.'
      })
    }
    if (block.dropItem !== 'self') {
      const vanilla = block.dropItem.startsWith('minecraft:')
      if (!vanilla && !itemIds.has(block.dropItem) && !blockIds.has(block.dropItem)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Block "${block.id}" drops unknown item "${block.dropItem}".`,
          action: 'Use self, a spec item/block id, or an allowlisted minecraft: id.'
        })
      }
      if (vanilla && !VANILLA_ITEMS.includes(block.dropItem as (typeof VANILLA_ITEMS)[number])) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Block "${block.id}" drop "${block.dropItem}" is not on the vanilla allowlist.`,
          action: 'Use self, a spec item id, or an allowlisted minecraft: id.'
        })
      }
    }
  }
  const uniqueBlockIds = spec.blocks.map((block) => block.id)
  if (new Set(uniqueBlockIds).size !== uniqueBlockIds.length) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: 'Block ids must be unique.',
      action: 'Rename duplicate blocks.'
    })
  }

  for (const item of spec.items) {
    if (item.durability > 0 && item.maxCount > 1) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Item "${item.id}" has durability and maxCount > 1.`,
        action: 'Damaged items cannot stack. Set stack size to 1 when durability is greater than 0.'
      })
    }
    const attrIds = item.attributes.map((attr) => attr.id)
    if (new Set(attrIds).size !== attrIds.length) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Item "${item.id}" repeats an attribute id.`,
        action: `Use each of ${ITEM_ATTRIBUTES.join(', ')} at most once (cap ${ITEM_ATTRIBUTE_CAP}).`
      })
    }
  }

  for (const entry of spec.worldgen) {
    if (entry.maxY < entry.minY) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Worldgen "${entry.id}" has maxY < minY.`,
        action: 'Set maxY at least as high as minY.'
      })
    }
    const bare = entry.block.includes(':') ? entry.block.slice(entry.block.indexOf(':') + 1) : entry.block
    if (entry.kind === 'ore_vein') {
      if (!isVanillaOre(entry.block) && !blockIds.has(bare) && !blockIds.has(entry.block)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Ore vein "${entry.id}" block "${entry.block}" is not a vanilla ore or spec block.`,
          action: 'Pick an allowlisted minecraft ore or a block defined in this spec.'
        })
      }
    } else if (entry.kind === 'surface_patch') {
      if (!isSurfacePatchPlant(entry.block) && !blockIds.has(bare) && !blockIds.has(entry.block)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Surface patch "${entry.id}" block "${entry.block}" is not an allowlisted plant or spec block.`,
          action: 'Use dandelion, poppy, short_grass, fern, dead_bush, or a spec block.'
        })
      }
    } else if (!isSpringFluid(entry.block)) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Spring "${entry.id}" fluid "${entry.block}" is not allowlisted.`,
        action: 'Use minecraft:water or minecraft:lava.'
      })
    }
  }
  const worldgenIds = spec.worldgen.map((entry) => entry.id)
  if (new Set(worldgenIds).size !== worldgenIds.length) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: 'Worldgen entry ids must be unique.',
      action: 'Rename duplicate ore-vein ids.'
    })
  }

  for (const gui of spec.modGuis) {
    for (const slot of gui.dataSlots) {
      if (!slot.ghostItemId) {
        continue
      }
      const vanilla = slot.ghostItemId.startsWith('minecraft:')
      if (vanilla && !VANILLA_ITEMS.includes(slot.ghostItemId as (typeof VANILLA_ITEMS)[number])) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `GUI "${gui.id}" ghost item "${slot.ghostItemId}" is not on the vanilla allowlist.`,
          action: 'Use a spec item id or an allowlisted minecraft: id.'
        })
      }
      if (!vanilla && !itemIds.has(slot.ghostItemId) && !blockIds.has(slot.ghostItemId)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `GUI "${gui.id}" ghost item "${slot.ghostItemId}" is unknown.`,
          action: 'Use a spec item/block id or an allowlisted minecraft: id.'
        })
      }
    }
  }

  for (const mob of spec.mobs) {
    if (mob.spawn.maxGroup < mob.spawn.minGroup) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Mob "${mob.id}" has a spawn table with maxGroup < minGroup.`,
        action: 'Set spawn maxGroup at least as high as minGroup.'
      })
    }
    if (mob.drops.some((drop) => drop.max < drop.min)) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Mob "${mob.id}" has a drop with max < min.`,
        action: 'Set drop max at least as high as min.'
      })
    }
    for (const drop of mob.drops) {
      const vanilla = drop.itemId.startsWith('minecraft:')
      if (!vanilla && !itemIds.has(drop.itemId) && !blockIds.has(drop.itemId)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Mob "${mob.id}" drops unknown item "${drop.itemId}".`,
          action: 'Use a spec item/block id or a minecraft: vanilla id.'
        })
      }
    }
    const goalIds = mob.goals.map((goal, index) => normalizeGoalEntry(goal, index).id)
    if (new Set(goalIds).size !== goalIds.length) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Mob "${mob.id}" repeats a goal.`,
        action: `Use each of ${MOB_GOALS.join(', ')} at most once (cap ${MOB_GOAL_CAP}).`
      })
    }
  }

  for (const gui of spec.pluginGuis) {
    for (const slot of gui.slots) {
      if (!gui.pagination && slot.index >= gui.rows * 9) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Plugin GUI "${gui.id}" slot ${slot.index} is outside ${gui.rows} rows.`,
          action: 'Use an index below rows × 9, or enable pagination to overflow onto extra pages.'
        })
      }
      if (slot.action === 'give' && slot.giveItemId && !itemIds.has(slot.giveItemId)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Plugin GUI "${gui.id}" give action references unknown item "${slot.giveItemId}".`,
          action: 'Give actions must use a spec item id.'
        })
      }
    }
  }

  const assertIngredient = (recipeId: string, kind: 'vanilla' | 'mod', id: string): void => {
    if (kind === 'vanilla') {
      if (!VANILLA_ITEMS.includes(id as (typeof VANILLA_ITEMS)[number])) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Vanilla ingredient "${id}" is not on the Phase 2 allowlist.`,
          action: `Use one of: ${VANILLA_ITEMS.slice(0, 8).join(', ')}, …`
        })
      }
    } else if (!itemIds.has(id)) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Recipe "${recipeId}" references unknown mod item "${id}".`,
        action: 'Mod ingredients must match an item id in this spec.'
      })
    }
  }

  for (const recipe of spec.recipes) {
    if (!itemIds.has(recipe.resultItemId)) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Recipe "${recipe.id}" results in unknown item "${recipe.resultItemId}".`,
        action: 'Result items must be items defined in this spec.'
      })
    }
    if (recipe.type === 'shapeless') {
      if (recipe.ingredients.length < 1) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Shapeless recipe "${recipe.id}" needs at least one ingredient.`,
          action: 'Add a vanilla or spec item ingredient.'
        })
      }
      for (const ingredient of recipe.ingredients) {
        assertIngredient(recipe.id, ingredient.kind, ingredient.id)
      }
    } else {
      if (recipe.pattern.length < 1 || recipe.pattern.length > 3) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Shaped recipe "${recipe.id}" needs a 1–3 row pattern.`,
          action: 'Use 1–3 rows of equal length (1–3 characters). Space is empty.'
        })
      }
      const width = recipe.pattern[0]?.length ?? 0
      if (width < 1 || width > 3 || recipe.pattern.some((row) => row.length !== width)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Shaped recipe "${recipe.id}" rows must be the same length (1–3).`,
          action: 'Pad shorter rows with spaces.'
        })
      }
      const letters = new Set(
        recipe.pattern
          .join('')
          .split('')
          .filter((ch) => /[A-Z]/.test(ch))
      )
      const keySymbols = recipe.keys.map((key) => key.symbol)
      if (new Set(keySymbols).size !== keySymbols.length) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Shaped recipe "${recipe.id}" has duplicate key symbols.`,
          action: 'Each A–Z letter may appear once in keys.'
        })
      }
      for (const letter of letters) {
        if (!keySymbols.includes(letter)) {
          throw new AppError({
            code: 'SPEC_INVALID',
            message: `Shaped recipe "${recipe.id}" pattern uses "${letter}" without a key.`,
            action: 'Add a key for every letter in the pattern.'
          })
        }
      }
      for (const key of recipe.keys) {
        if (!letters.has(key.symbol)) {
          throw new AppError({
            code: 'SPEC_INVALID',
            message: `Shaped recipe "${recipe.id}" key "${key.symbol}" is unused.`,
            action: 'Remove unused keys or put the letter in the pattern.'
          })
        }
        assertIngredient(recipe.id, key.kind, key.id)
      }
    }
  }

  return spec
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: 'The model returned an empty response.',
      action: 'Try again, pick another local model, or generate from the trusted template only.'
    })
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fence?.[1]?.trim() ?? trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: 'The model response did not contain a JSON object.',
      action: 'Regenerate, or use template-only generation for a simple item.',
      details: candidate.slice(0, 500)
    })
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch (error) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: 'The model response was not valid JSON.',
      action: 'CraftStudio will try a limited repair. If that fails, use the trusted template.',
      details: error instanceof Error ? error.message : String(error)
    })
  }
}

export function parseSpecJson(raw: string): ProjectSpec {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: 'spec JSON could not be parsed.',
      action: 'Delete craftstudio.spec.json or regenerate it.',
      details: error instanceof Error ? error.message : String(error)
    })
  }
  return parseProjectSpec(parsed)
}

export function toConstName(id: string): string {
  return id.replace(/[^a-z0-9]+/g, '_').toUpperCase()
}

export function toModId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'm$1')
    .slice(0, 24)
  return slug.length >= 2 ? slug : 'example_mod'
}

export function toMainClass(name: string): string {
  const parts = name.match(/[A-Za-z0-9]+/g) ?? ['Example']
  const joined = parts.map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase()).join('')
  const cls = (joined || 'ExampleMod').replace(/[^A-Za-z0-9]/g, '')
  return /^[A-Z]/.test(cls) ? cls.slice(0, 48) : `Mod${cls}`.slice(0, 48)
}

export function toPackageName(modId: string): string {
  return `local.craftstudio.${modId}`
}
