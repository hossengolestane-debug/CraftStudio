import { describe, expect, it } from 'vitest'
import { AppError } from '../src/shared/errors'
import { extractJsonObject, parseProjectSpec, toModId } from '../src/shared/spec'
import { inferSpecFromPrompt } from '../src/shared/templateInfer'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const manifest: ProjectManifest = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'River Stones',
  description: 'Adds polished river stones.',
  type: 'mod',
  platform: 'fabric',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T01:00:00.000Z',
  updatedAt: '2026-09-18T01:00:00.000Z',
  features: {
    customItems: false,
    customMobs: false,
    customGuis: false,
    customBlocks: false,
    recipes: false
  },
  schemaVersion: MANIFEST_SCHEMA_VERSION
}

const valid = {
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
  prompt: 'add a river stone'
}

describe('project spec validation', () => {
  it('accepts a minimal valid spec', () => {
    expect(parseProjectSpec(valid).items[0]?.id).toBe('river_stone')
  })

  it('rejects traversal-like package names', () => {
    expect(() => parseProjectSpec({ ...valid, packageName: 'local..craftstudio' })).toThrow(AppError)
    expect(() => parseProjectSpec({ ...valid, packageName: '../evil' })).toThrow(AppError)
  })

  it('rejects uppercase item ids and empty item lists', () => {
    expect(() => parseProjectSpec({ ...valid, items: [] })).toThrow(/valid/)
    expect(() =>
      parseProjectSpec({ ...valid, items: [{ id: 'River-Stone', displayName: 'X' }] })
    ).toThrow(AppError)
  })

  it('rejects recipes that mention unknown items or disallowed vanilla ids', () => {
    expect(() =>
      parseProjectSpec({
        ...valid,
        recipes: [
          {
            id: 'bad',
            type: 'shapeless',
            resultItemId: 'missing',
            ingredients: [{ kind: 'vanilla', id: 'minecraft:cobblestone' }]
          }
        ]
      })
    ).toThrow(/unknown item/)
    expect(() =>
      parseProjectSpec({
        ...valid,
        recipes: [
          {
            id: 'bad2',
            type: 'shapeless',
            resultItemId: 'river_stone',
            ingredients: [{ kind: 'vanilla', id: 'minecraft:nether_star' }]
          }
        ]
      })
    ).toThrow(/allowlist/)
  })

  it('extracts JSON from fenced model output and rejects garbage', () => {
    const extracted = extractJsonObject(`Sure.\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``)
    expect(parseProjectSpec(extracted).modId).toBe('river_stones')
    expect(() => extractJsonObject('no json here')).toThrow(/JSON object/)
    expect(() => extractJsonObject('{"nope":')).toThrow(/JSON/)
  })

  it('infers a template spec from a simple prompt', () => {
    const spec = inferSpecFromPrompt(manifest, 'Add an item called "polished pebble" and a recipe')
    expect(spec.source).toBe('template')
    expect(spec.items[0]?.id).toMatch(/polished/)
    expect(spec.recipes.length).toBe(1)
    expect(toModId('River Stones')).toBe('river_stones')
  })

  it('records unsupported mob/GUI requests without inventing those features', () => {
    const spec = inferSpecFromPrompt(manifest, 'Add a custom mob and a GUI')
    expect(spec.unsupportedRequests.map((item) => item.feature)).toEqual(
      expect.arrayContaining(['custom entities', 'custom GUIs'])
    )
    expect(spec.items.length).toBe(1)
  })
})
