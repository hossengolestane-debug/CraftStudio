import { describe, expect, it } from 'vitest'
import { defaultRecipe, removeItem, upsertItem, upsertRecipe, withEditorSource } from '../src/shared/editorSpec'
import { parseProjectSpec } from '../src/shared/spec'

const base = parseProjectSpec({
  schemaVersion: 1,
  modId: 'river_stones',
  displayName: 'River Stones',
  description: 'Adds polished river stones.',
  packageName: 'local.craftstudio.river_stones',
  mainClass: 'RiverStones',
  items: [{ id: 'river_stone', displayName: 'River Stone', maxCount: 64, rarity: 'common' }],
  recipes: [],
  commands: [],
  unsupportedRequests: [],
  source: 'template',
  prompt: 'item'
})

describe('item editor spec round-trip', () => {
  it('edits name, id, stack size and binds a recipe', () => {
    const renamed = upsertItem(
      base,
      { id: 'polished_pebble', displayName: 'Polished Pebble', description: '', maxCount: 16, rarity: 'uncommon' },
      0
    )
    expect(renamed.source).toBe('editor')
    expect(renamed.items[0]?.id).toBe('polished_pebble')
    expect(renamed.items[0]?.maxCount).toBe(16)

    const withRecipe = upsertRecipe(renamed, defaultRecipe('polished_pebble'))
    const again = parseProjectSpec(withRecipe)
    expect(again.recipes[0]?.resultItemId).toBe('polished_pebble')
    expect(again.recipes[0]?.ingredients[0]?.id).toBe('minecraft:stick')
    expect(again.source).toBe('editor')
  })

  it('refuses dropping the last item', () => {
    expect(() => removeItem(base, 'river_stone')).toThrow(/valid/)
  })

  it('marks editor source without requiring Ollama', () => {
    expect(withEditorSource(base).source).toBe('editor')
  })
})
