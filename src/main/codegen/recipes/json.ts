import type { ProjectSpec, SpecRecipe } from '../../../shared/spec'
import { enchantmentResultComponents } from '../weapons/forgeWeapon'
import type { PlannedFile } from '../types'

function ingredientRef(spec: ProjectSpec, kind: 'vanilla' | 'mod', id: string): { item: string } {
  return { item: kind === 'vanilla' ? id : `${spec.modId}:${id}` }
}

export function recipeJson(spec: ProjectSpec, recipe: SpecRecipe): Record<string, unknown> {
  const item = spec.items.find((entry) => entry.id === recipe.resultItemId)
  const components = item ? enchantmentResultComponents(item) : undefined
  const result: Record<string, unknown> = {
    id: `${spec.modId}:${recipe.resultItemId}`,
    count: recipe.resultCount
  }
  if (components) {
    result.components = components
  }
  if (recipe.type === 'shaped') {
    const key: Record<string, { item: string }> = {}
    for (const entry of recipe.keys) {
      key[entry.symbol] = ingredientRef(spec, entry.kind, entry.id)
    }
    return {
      type: 'minecraft:crafting_shaped',
      pattern: recipe.pattern,
      key,
      result
    }
  }
  return {
    type: 'minecraft:crafting_shapeless',
    ingredients: recipe.ingredients.map((ingredient) => ingredientRef(spec, ingredient.kind, ingredient.id)),
    result
  }
}

export function planRecipeFiles(spec: ProjectSpec): PlannedFile[] {
  return spec.recipes.map((recipe) => ({
    relativePath: `src/main/resources/data/${spec.modId}/recipe/${recipe.id}.json`,
    encoding: 'utf8' as const,
    contents: `${JSON.stringify(recipeJson(spec, recipe), null, 2)}\n`
  }))
}
