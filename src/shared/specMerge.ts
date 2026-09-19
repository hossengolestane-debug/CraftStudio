import { preservePrompt, shortSummary } from './promptPreserve'
import { extractShapedRecipeFromPrompt } from './recipeExtract'
import {
  inferWeaponFromPrompt,
  mergeWeapons,
  promptRequestsChestLoot,
  promptRequestsCustomMob,
  promptRequestsWorldgen,
  type SpecWeapon
} from './weaponSpec'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Array.isArray(value) === false
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export interface IdentityFields {
  modId: string
  displayName: string
  packageName: string
  mainClass: string
  description?: string
}

/**
 * Assemble a spec from model JSON + identity fields.
 * Does not copy template mobs, loot, worldgen, or iron+stick recipes into omitted model arrays.
 */
export function assembleGeneratedSpec(input: {
  identity: IdentityFields
  model: unknown
  originalPrompt: string
  source: 'template' | 'ollama' | 'editor'
  fallbackItems?: unknown[]
  fallbackRecipes?: unknown[]
}): Record<string, unknown> {
  const model = isRecord(input.model) ? input.model : {}
  const prompt = preservePrompt(input.originalPrompt)
  const wantsLoot = promptRequestsChestLoot(prompt)
  const wantsWorldgen = promptRequestsWorldgen(prompt)
  const wantsMob = promptRequestsCustomMob(prompt)

  const modelItems = asArray(model.items)
  const items = modelItems.length > 0 ? modelItems : (input.fallbackItems ?? [])
  const modelRecipes = Array.isArray(model.recipes) ? model.recipes : undefined
  const extracted = extractShapedRecipeFromPrompt(prompt)
  let recipes: unknown[] = []
  if (extracted && items[0] && isRecord(items[0])) {
    const itemId = typeof items[0].id === 'string' ? items[0].id : 'custom_item'
    recipes = [
      {
        id: `${itemId.slice(0, 18)}_shaped`,
        type: 'shaped',
        resultItemId: itemId,
        resultCount: 1,
        ingredients: [],
        pattern: extracted.pattern,
        keys: extracted.keys
      }
    ]
  } else if (modelRecipes && modelRecipes.length > 0) {
    recipes = modelRecipes
  } else if (input.fallbackRecipes && input.fallbackRecipes.length > 0) {
    recipes = input.fallbackRecipes
  }

  const modelConfig = isRecord(model.config) ? model.config : {}
  const weapon = inferWeaponFromPrompt(prompt)
  const decoratedItems = attachInferredWeapon(items, weapon, prompt)

  return {
    schemaVersion: 1,
    modId: typeof model.modId === 'string' ? model.modId : input.identity.modId,
    displayName: typeof model.displayName === 'string' ? model.displayName : input.identity.displayName,
    description:
      typeof model.description === 'string' && model.description.trim()
        ? shortSummary(model.description, 2000)
        : shortSummary(input.identity.description || prompt, 2000),
    packageName: input.identity.packageName,
    mainClass: input.identity.mainClass,
    items: decoratedItems,
    blocks: Array.isArray(model.blocks) ? model.blocks : [],
    recipes,
    commands: Array.isArray(model.commands) ? model.commands : [],
    mobs: wantsMob && Array.isArray(model.mobs) ? model.mobs : [],
    modGuis: Array.isArray(model.modGuis) ? model.modGuis : [],
    pluginGuis: Array.isArray(model.pluginGuis) ? model.pluginGuis : [],
    worldgen: wantsWorldgen && Array.isArray(model.worldgen) ? model.worldgen : [],
    config: {
      enableWorldgen: wantsWorldgen && modelConfig.enableWorldgen === true,
      enableChestLoot: wantsLoot && modelConfig.enableChestLoot !== false ? true : wantsLoot,
      spawnWeightScale: typeof modelConfig.spawnWeightScale === 'number' ? modelConfig.spawnWeightScale : 1,
      enableTerrainDestruction:
        typeof modelConfig.enableTerrainDestruction === 'boolean'
          ? modelConfig.enableTerrainDestruction
          : Boolean(weapon?.terrain?.enabled)
    },
    unsupportedRequests: Array.isArray(model.unsupportedRequests) ? model.unsupportedRequests : [],
    source: input.source,
    prompt
  }
}

function attachInferredWeapon(items: unknown[], inferred: SpecWeapon | undefined, prompt: string): unknown[] {
  if (!inferred) {
    return items
  }
  return items.map((item) => {
    if (!isRecord(item)) {
      return item
    }
    const existing = isRecord(item.weapon) ? (item.weapon as SpecWeapon) : undefined
    const weapon = mergeWeapons(existing, inferred, prompt)
    if (!weapon) {
      return item
    }
    return {
      ...item,
      description:
        typeof item.description === 'string' && item.description.length <= 400
          ? item.description
          : shortSummary(typeof item.description === 'string' ? item.description : prompt, 400),
      weapon
    }
  })
}

export function dropUnsolicitedSystems<T extends { feature: string; reason: string }>(
  extras: T[],
  prompt: string
): T[] {
  const wantsMob = promptRequestsCustomMob(prompt)
  return extras.filter((item) => {
    if (!wantsMob && /custom mob|new (client )?entity/i.test(item.feature)) {
      return false
    }
    return true
  })
}
