import { defaultItem, defaultRecipe, defaultShapedRecipe, EDITOR_VANILLA_ITEMS } from '../../../../shared/editorSpec'
import { ITEM_ATTRIBUTES, ITEM_ATTRIBUTE_SLOTS, type ProjectSpec, type SpecItem, type SpecRecipe } from '../../../../shared/spec'
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
          Edit name, id, stack size, durability, a few attributes, and shapeless or shaped recipes without Ollama. Apply
          still shows diffs. Java and Gradle stay template-authored.
        </p>
        {paperLimits ? (
          <p className="mt-2 text-sm">
            Plugins cannot add a new client item id. The generated plugin uses vanilla <code>paper</code> plus persistent
            data and CustomModelData. Players must install the exported resource pack on their client.
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
            <Field label="Model style" htmlFor={`item-model-${index}`} hint="Preview parent only — not Minecraft-verified.">
              <select
                id={`item-model-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={item.modelStyle}
                onChange={(event) =>
                  updateItem(index, { modelStyle: event.target.value as SpecItem['modelStyle'] })
                }
              >
                <option value="generated">generated</option>
                <option value="handheld">handheld</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.layer1}
                onChange={(event) => updateItem(index, { layer1: event.target.checked })}
              />
              Include layer1 texture slot
            </label>
            <Field
              label="Durability"
              htmlFor={`item-dur-${index}`}
              hint="0 = none. Mods emit maxDamage/durability. Plugins cannot add real tool durability on paper disguises."
            >
              <TextInput
                id={`item-dur-${index}`}
                inputMode="numeric"
                value={String(item.durability)}
                onChange={(event) => {
                  const durability = Math.min(4096, Math.max(0, Number(event.target.value) || 0))
                  updateItem(index, { durability, maxCount: durability > 0 ? 1 : item.maxCount })
                }}
              />
            </Field>
          </div>
          <div className="space-y-2 border border-dashed border-line p-2">
            <p className="text-xs text-muted">Attributes (max 4). Conservative subset only — not a full equipment system.</p>
            {item.attributes.map((attr, attrIndex) => (
              <div key={`${attr.id}-${attrIndex}`} className="grid gap-2 md:grid-cols-4">
                <select
                  className="border border-line bg-white px-2 py-1"
                  value={attr.id}
                  onChange={(event) => {
                    const attributes = item.attributes.map((entry, i) =>
                      i === attrIndex ? { ...entry, id: event.target.value as typeof attr.id } : entry
                    )
                    updateItem(index, { attributes })
                  }}
                >
                  {ITEM_ATTRIBUTES.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                <TextInput
                  inputMode="decimal"
                  value={String(attr.amount)}
                  onChange={(event) => {
                    const attributes = item.attributes.map((entry, i) =>
                      i === attrIndex
                        ? { ...entry, amount: Math.min(64, Math.max(-64, Number(event.target.value) || 0)) }
                        : entry
                    )
                    updateItem(index, { attributes })
                  }}
                />
                <select
                  className="border border-line bg-white px-2 py-1"
                  value={attr.slot}
                  onChange={(event) => {
                    const attributes = item.attributes.map((entry, i) =>
                      i === attrIndex ? { ...entry, slot: event.target.value as typeof attr.slot } : entry
                    )
                    updateItem(index, { attributes })
                  }}
                >
                  {ITEM_ATTRIBUTE_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    updateItem(index, { attributes: item.attributes.filter((_, i) => i !== attrIndex) })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={item.attributes.length >= 4}
              onClick={() =>
                updateItem(index, {
                  attributes: [...item.attributes, { id: 'attack_damage', amount: 1, slot: 'mainhand' }]
                })
              }
            >
              Add attribute
            </Button>
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

      <h3 className="font-semibold">Recipes</h3>
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
            <Field label="Type" htmlFor={`recipe-type-${index}`}>
              <select
                id={`recipe-type-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={recipe.type}
                onChange={(event) => {
                  const type = event.target.value as SpecRecipe['type']
                  if (type === 'shaped') {
                    updateRecipe(index, {
                      ...defaultShapedRecipe(recipe.resultItemId),
                      id: recipe.id,
                      resultCount: recipe.resultCount
                    })
                  } else {
                    updateRecipe(index, {
                      type: 'shapeless',
                      ingredients: [{ kind: 'vanilla', id: EDITOR_VANILLA_ITEMS[0] }],
                      pattern: [],
                      keys: []
                    })
                  }
                }}
              >
                <option value="shapeless">shapeless</option>
                <option value="shaped">shaped</option>
              </select>
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
            {recipe.type === 'shapeless' ? (
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
            ) : (
              <Field
                label="Pattern (3 rows)"
                htmlFor={`recipe-pattern-${index}`}
                hint="A–Z letters plus spaces. Keys must cover every letter."
              >
                <TextInput
                  id={`recipe-pattern-${index}`}
                  value={recipe.pattern.join('|')}
                  onChange={(event) =>
                    updateRecipe(index, {
                      pattern: event.target.value.split('|').slice(0, 3).map((row) => row.slice(0, 3))
                    })
                  }
                />
              </Field>
            )}
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
          {recipe.type === 'shaped' ? (
            <p className="text-xs text-muted">
              Keys: {recipe.keys.map((key) => `${key.symbol}=${key.id}`).join(', ') || 'none'}
            </p>
          ) : null}
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

      <div className="flex flex-wrap gap-2">
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
        <Button
          type="button"
          variant="secondary"
          disabled={spec.recipes.length >= 8 || spec.items.length === 0}
          onClick={() =>
            onChange({
              ...spec,
              recipes: [...spec.recipes, defaultShapedRecipe(spec.items[0]?.id ?? 'custom_item')],
              source: 'editor'
            })
          }
        >
          Add shaped recipe
        </Button>
      </div>
    </Card>
  )
}
