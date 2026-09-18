import { z } from 'zod'
import { AppError } from './errors'
import { SPEC_FILENAME } from './types'

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
  'stationary_lookout'
] as const
export const MOB_MODELS = ['humanoid', 'quadruped', 'vanilla_disguise'] as const
export const VANILLA_MOB_BASES = ['minecraft:zombie', 'minecraft:pig', 'minecraft:wolf'] as const
export const ITEM_MODEL_STYLES = ['generated', 'handheld'] as const

const itemSchema = z.object({
  id: ident,
  displayName: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).default(''),
  maxCount: z.number().int().min(1).max(64).default(64),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic']).default('common'),
  modelStyle: z.enum(ITEM_MODEL_STYLES).default('generated'),
  layer1: z.boolean().default(false)
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
  targeting: z.enum(['none', 'players', 'hostiles']).default('none'),
  spawnStub: z.string().trim().max(200).default('No custom biome spawn table in Phase 6 — summon/command only.'),
  drops: z.array(mobDropSchema).max(4).default([]),
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

const modGuiSchema = z.object({
  id: ident,
  title: z.string().trim().min(1).max(80),
  width: z.number().int().min(100).max(400).default(176),
  height: z.number().int().min(80).max(300).default(166),
  widgets: z.array(modGuiWidgetSchema).min(1).max(12)
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
  slots: z.array(pluginGuiSlotSchema).min(1).max(27)
})

const recipeIngredientSchema = z.object({
  kind: z.enum(['vanilla', 'mod']),
  id: z.string().trim().min(3).max(64)
})

const recipeSchema = z.object({
  id: ident,
  type: z.enum(['shapeless']),
  resultItemId: ident,
  resultCount: z.number().int().min(1).max(64).default(1),
  ingredients: z.array(recipeIngredientSchema).min(1).max(9)
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
  recipes: z.array(recipeSchema).max(8).default([]),
  commands: z.array(commandSchema).max(4).default([]),
  mobs: z.array(mobSchema).max(4).default([]),
  modGuis: z.array(modGuiSchema).max(4).default([]),
  pluginGuis: z.array(pluginGuiSchema).max(4).default([]),
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

export const OLLAMA_SPEC_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'modId',
    'displayName',
    'description',
    'packageName',
    'mainClass',
    'items',
    'recipes',
    'commands',
    'unsupportedRequests',
    'source'
  ],
  properties: {
    schemaVersion: { type: 'integer', const: SPEC_SCHEMA_VERSION },
    modId: { type: 'string' },
    displayName: { type: 'string' },
    description: { type: 'string' },
    packageName: { type: 'string' },
    mainClass: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'displayName'],
        properties: {
          id: { type: 'string' },
          displayName: { type: 'string' },
          description: { type: 'string' },
          maxCount: { type: 'integer' },
          rarity: { type: 'string', enum: ['common', 'uncommon', 'rare', 'epic'] },
          modelStyle: { type: 'string', enum: ['generated', 'handheld'] },
          layer1: { type: 'boolean' }
        }
      }
    },
    recipes: { type: 'array' },
    commands: { type: 'array' },
    mobs: { type: 'array' },
    modGuis: { type: 'array' },
    pluginGuis: { type: 'array' },
    unsupportedRequests: { type: 'array' },
    source: { type: 'string', enum: ['template', 'ollama', 'merged'] },
    prompt: { type: 'string' }
  }
} as const

export function specIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'spec'}: ${issue.message}`)
    .join('\n')
}

export function parseProjectSpec(input: unknown): ProjectSpec {
  const parsed = projectSpecSchema.safeParse(input)
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

  for (const mob of spec.mobs) {
    if (mob.drops.some((drop) => drop.max < drop.min)) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Mob "${mob.id}" has a drop with max < min.`,
        action: 'Set drop max at least as high as min.'
      })
    }
    for (const drop of mob.drops) {
      const vanilla = drop.itemId.startsWith('minecraft:')
      if (!vanilla && !itemIds.has(drop.itemId)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Mob "${mob.id}" drops unknown item "${drop.itemId}".`,
          action: 'Use a spec item id or a minecraft: vanilla id.'
        })
      }
    }
  }

  for (const gui of spec.pluginGuis) {
    for (const slot of gui.slots) {
      if (slot.index >= gui.rows * 9) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Plugin GUI "${gui.id}" slot ${slot.index} is outside ${gui.rows} rows.`,
          action: 'Use an index below rows × 9.'
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

  for (const recipe of spec.recipes) {
    if (!itemIds.has(recipe.resultItemId)) {
      throw new AppError({
        code: 'SPEC_INVALID',
        message: `Recipe "${recipe.id}" results in unknown item "${recipe.resultItemId}".`,
        action: 'Result items must be items defined in this spec.'
      })
    }
    for (const ingredient of recipe.ingredients) {
      if (ingredient.kind === 'vanilla') {
        if (!VANILLA_ITEMS.includes(ingredient.id as (typeof VANILLA_ITEMS)[number])) {
          throw new AppError({
            code: 'SPEC_INVALID',
            message: `Vanilla ingredient "${ingredient.id}" is not on the Phase 2 allowlist.`,
            action: `Use one of: ${VANILLA_ITEMS.slice(0, 8).join(', ')}, …`
          })
        }
      } else if (!itemIds.has(ingredient.id)) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: `Recipe "${recipe.id}" references unknown mod item "${ingredient.id}".`,
          action: 'Mod ingredients must match an item id in this spec.'
        })
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
