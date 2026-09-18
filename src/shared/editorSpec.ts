import { parseProjectSpec, VANILLA_ITEMS, type ProjectSpec, type SpecItem, type SpecRecipe, type SpecWorldgen } from './spec'
import { defaultWorldgen } from './worldgen'

export function withEditorSource(spec: ProjectSpec): ProjectSpec {
  return parseProjectSpec({ ...spec, source: 'editor' })
}

export function upsertItem(spec: ProjectSpec, item: SpecItem, index?: number): ProjectSpec {
  const items = [...spec.items]
  if (index === undefined || index < 0 || index >= items.length) {
    items.push(item)
  } else {
    const previous = items[index]
    items[index] = item
    const recipes = spec.recipes.map((recipe) =>
      previous && recipe.resultItemId === previous.id ? { ...recipe, resultItemId: item.id } : recipe
    )
    return withEditorSource({ ...spec, items, recipes })
  }
  return withEditorSource({ ...spec, items })
}

export function removeItem(spec: ProjectSpec, itemId: string): ProjectSpec {
  const items = spec.items.filter((item) => item.id !== itemId)
  const recipes = spec.recipes.filter((recipe) => recipe.resultItemId !== itemId)
  return withEditorSource({ ...spec, items, recipes })
}

export function upsertRecipe(spec: ProjectSpec, recipe: SpecRecipe, index?: number): ProjectSpec {
  const recipes = [...spec.recipes]
  if (index === undefined || index < 0 || index >= recipes.length) {
    recipes.push(recipe)
  } else {
    recipes[index] = recipe
  }
  return withEditorSource({ ...spec, recipes })
}

export function removeRecipe(spec: ProjectSpec, recipeId: string): ProjectSpec {
  return withEditorSource({
    ...spec,
    recipes: spec.recipes.filter((recipe) => recipe.id !== recipeId)
  })
}

export function defaultItem(id = 'custom_item'): SpecItem {
  return {
    id,
    displayName: 'Custom Item',
    description: '',
    maxCount: 64,
    rarity: 'common',
    modelStyle: 'generated',
    layer1: false,
    durability: 0,
    attributes: []
  }
}

export function defaultRecipe(resultItemId: string): SpecRecipe {
  return {
    id: `${resultItemId.slice(0, 18)}_shapeless`,
    type: 'shapeless',
    resultItemId,
    resultCount: 1,
    ingredients: [{ kind: 'vanilla', id: VANILLA_ITEMS[0] }],
    pattern: [],
    keys: []
  }
}

export function defaultShapedRecipe(resultItemId: string): SpecRecipe {
  return {
    id: `${resultItemId.slice(0, 18)}_shaped`,
    type: 'shaped',
    resultItemId,
    resultCount: 1,
    ingredients: [],
    pattern: [' X ', ' X ', ' S '],
    keys: [
      { symbol: 'X', kind: 'vanilla', id: 'minecraft:iron_ingot' },
      { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
    ]
  }
}

export function defaultWorldgenEntry(id = 'iron_vein'): SpecWorldgen {
  return defaultWorldgen(id)
}

export const EDITOR_VANILLA_ITEMS = VANILLA_ITEMS
