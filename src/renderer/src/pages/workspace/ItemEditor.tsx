import { defaultItem, defaultRecipe, EDITOR_VANILLA_ITEMS } from '../../../../shared/editorSpec'
import type { ProjectSpec, SpecItem, SpecRecipe } from '../../../../shared/spec'
import { Button, Card, Field, TextInput } from '../../components/ui'

export function ItemEditor({
  spec,
  onChange,
  paperLimits
}: {
  spec: ProjectSpec
  onChange: (spec: ProjectSpec) => void
  paperLimits: boolean
}) {
  const updateItem = (index: number, patch: Partial<SpecItem>): void => {
    const current = spec.items[index]
    if (!current) {
      return
    }
    const items = spec.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    const recipes = spec.recipes.map((recipe) =>
      recipe.resultItemId === current.id && patch.id ? { ...recipe, resultItemId: patch.id } : recipe
    )
    onChange({ ...spec, items, recipes, source: 'editor' })
  }

  const updateRecipe = (index: number, patch: Partial<SpecRecipe>): void => {
    const recipes = spec.recipes.map((recipe, recipeIndex) =>
      recipeIndex === index ? { ...recipe, ...patch } : recipe
    )
    onChange({ ...spec, recipes, source: 'editor' })
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Item editor</h2>
        <p className="mt-1 text-sm text-muted">
          Edit name, id, stack size, and a shapeless recipe without Ollama. Apply still shows diffs. Java and Gradle stay
          template-authored.
        </p>
        {paperLimits ? (
          <p className="mt-2 text-sm">
            Paper cannot add a new client item id. The generated plugin uses vanilla <code>paper</code> plus persistent
            data. Players see a renamed paper item unless they add their own resource pack (not exported).
          </p>
        ) : null}
      </div>

      {spec.items.map((item, index) => (
        <div key={`${item.id}-${index}`} className="space-y-3 border border-line p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Display name" htmlFor={`item-name-${index}`}>
              <TextInput
                id={`item-name-${index}`}
                value={item.displayName}
                maxLength={80}
                onChange={(event) => updateItem(index, { displayName: event.target.value })}
              />
            </Field>
            <Field label="Identifier" htmlFor={`item-id-${index}`} hint="lowercase [a-z0-9_], 2–31 characters.">
              <TextInput
                id={`item-id-${index}`}
                value={item.id}
                maxLength={31}
                onChange={(event) => updateItem(index, { id: event.target.value })}
              />
            </Field>
            <Field label="Stack size" htmlFor={`item-count-${index}`}>
              <TextInput
                id={`item-count-${index}`}
                inputMode="numeric"
                value={String(item.maxCount)}
                onChange={(event) =>
                  updateItem(index, { maxCount: Math.min(64, Math.max(1, Number(event.target.value) || 1)) })
                }
              />
            </Field>
            <Field label="Rarity" htmlFor={`item-rarity-${index}`}>
              <select
                id={`item-rarity-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={item.rarity}
                onChange={(event) =>
                  updateItem(index, { rarity: event.target.value as SpecItem['rarity'] })
                }
              >
                <option value="common">common</option>
                <option value="uncommon">uncommon</option>
                <option value="rare">rare</option>
                <option value="epic">epic</option>
              </select>
            </Field>
          </div>
          {spec.items.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...spec,
                  items: spec.items.filter((_, itemIndex) => itemIndex !== index),
                  recipes: spec.recipes.filter((recipe) => recipe.resultItemId !== item.id),
                  source: 'editor'
                })
              }
            >
              Remove item
            </Button>
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        disabled={spec.items.length >= 8}
        onClick={() =>
          onChange({
            ...spec,
            items: [...spec.items, defaultItem(`item_${spec.items.length + 1}`)],
            source: 'editor'
          })
        }
      >
        Add item
      </Button>

      <h3 className="font-semibold">Shapeless recipes</h3>
      {spec.recipes.map((recipe, index) => (
        <div key={`${recipe.id}-${index}`} className="space-y-3 border border-line p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Recipe id" htmlFor={`recipe-id-${index}`}>
              <TextInput
                id={`recipe-id-${index}`}
                value={recipe.id}
                onChange={(event) => updateRecipe(index, { id: event.target.value })}
              />
            </Field>
            <Field label="Result item" htmlFor={`recipe-result-${index}`}>
              <select
                id={`recipe-result-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={recipe.resultItemId}
                onChange={(event) => updateRecipe(index, { resultItemId: event.target.value })}
              >
                {spec.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName} ({item.id})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vanilla ingredient" htmlFor={`recipe-ing-${index}`}>
              <select
                id={`recipe-ing-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={recipe.ingredients[0]?.id ?? EDITOR_VANILLA_ITEMS[0]}
                onChange={(event) =>
                  updateRecipe(index, { ingredients: [{ kind: 'vanilla', id: event.target.value }] })
                }
              >
                {EDITOR_VANILLA_ITEMS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Result count" htmlFor={`recipe-count-${index}`}>
              <TextInput
                id={`recipe-count-${index}`}
                inputMode="numeric"
                value={String(recipe.resultCount)}
                onChange={(event) =>
                  updateRecipe(index, { resultCount: Math.min(64, Math.max(1, Number(event.target.value) || 1)) })
                }
              />
            </Field>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange({
                ...spec,
                recipes: spec.recipes.filter((_, recipeIndex) => recipeIndex !== index),
                source: 'editor'
              })
            }
          >
            Remove recipe
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        disabled={spec.recipes.length >= 8 || spec.items.length === 0}
        onClick={() =>
          onChange({
            ...spec,
            recipes: [...spec.recipes, defaultRecipe(spec.items[0]?.id ?? 'custom_item')],
            source: 'editor'
          })
        }
      >
        Add shapeless recipe
      </Button>
    </Card>
  )
}
