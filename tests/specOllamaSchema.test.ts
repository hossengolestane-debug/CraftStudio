import { afterEach, describe, expect, it, vi } from 'vitest'
import { planForgeFiles } from '../src/main/codegen/forge/emitter'
import { OllamaService } from '../src/main/services/ollamaService'
import { ITEM_ATTRIBUTES } from '../src/shared/itemStats'
import { JSON_SCHEMA_CROSS_FIELD_RULES, summarizeJsonSchema } from '../src/shared/ollamaSpecSchema'
import { OLLAMA_SPEC_JSON_SCHEMA, parseProjectSpec, projectSpecSchema } from '../src/shared/spec'
import { normalizeSpecDraft } from '../src/shared/specNormalize'
import { MINIMAL_VALID_SPEC_EXAMPLE, SPEC_SYSTEM_PROMPT } from '../src/shared/specPrompt'
import { collectUnsupportedFromPrompt } from '../src/shared/templateInfer'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

/** Observed Ollama Legendary Mace-style output that failed Zod on the user machine. */
export const LEGENDARY_MACE_INVALID_OLLAMA = {
  schemaVersion: 1,
  modId: 'legendary_mace',
  displayName: 'Legendary Mace',
  description: 'A legendary mace with life steal and smash.',
  packageName: 'local.craftstudio.legendary_mace',
  mainClass: 'LegendaryMace',
  items: [
    {
      id: 'legendary_mace',
      displayName: 'Legendary Mace',
      maxCount: 1,
      durability: 500,
      modelStyle: 'handheld',
      rarity: 'epic',
      attributes: [
        { id: 'generic.attackDamage', amount: 8 },
        { id: 'generic.attack_speed', amount: -2.4 },
        { amount: 2 }
      ]
    }
  ],
  recipes: [
    {
      id: 'legendary_mace_shaped',
      type: 'shaped',
      result: 'legendary_mace',
      pattern: [' b ', ' s ', ' s '],
      key: {
        B: { item: 'minecraft:breeze_rod' },
        S: { item: 'minecraft:stick' }
      }
    }
  ],
  commands: ['givemace'],
  unsupportedRequests: ['life steal'],
  source: 'ollama',
  prompt: 'Legendary Mace with life steal, shockwave terrain smash, and Density enchantment'
}

const LEGENDARY_MACE_CORRECTED = {
  schemaVersion: 1,
  modId: 'legendary_mace',
  displayName: 'Legendary Mace',
  description: 'A heavy custom item. Smash, life steal, and shockwaves are unsupported.',
  packageName: 'local.craftstudio.legendary_mace',
  mainClass: 'LegendaryMace',
  items: [
    {
      id: 'legendary_mace',
      displayName: 'Legendary Mace',
      maxCount: 1,
      durability: 500,
      modelStyle: 'handheld',
      rarity: 'epic',
      attributes: [
        { id: 'attack_damage', amount: 8, slot: 'mainhand' },
        { id: 'attack_speed', amount: -2.4, slot: 'mainhand' }
      ]
    }
  ],
  recipes: [
    {
      id: 'legendary_mace_shaped',
      type: 'shaped',
      resultItemId: 'legendary_mace',
      resultCount: 1,
      ingredients: [],
      pattern: [' I ', ' S ', ' S '],
      keys: [
        { symbol: 'I', kind: 'vanilla', id: 'minecraft:iron_ingot' },
        { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
      ]
    }
  ],
  commands: [{ name: 'givemace', description: 'Stub give command. Not a command engine.' }],
  unsupportedRequests: [
    {
      feature: 'mace combat',
      reason: 'CraftStudio items are generic custom items. 1.21 mace smash, Density, and Breach are not emitted.'
    },
    {
      feature: 'life steal',
      reason: 'No custom on-hit healing effect is generated.'
    },
    {
      feature: 'shockwave / terrain',
      reason: 'No area damage or terrain modification is generated.'
    },
    {
      feature: 'enchantments',
      reason: 'Custom enchantments are not registered.'
    },
    {
      feature: 'ingredient minecraft:breeze_rod',
      reason: 'Asked breeze_rod is not on the vanilla allowlist. It was not swapped for iron_ingot; the human chose an allowlisted recipe after the gap was recorded.'
    }
  ],
  source: 'merged',
  prompt: 'Legendary Mace with life steal, shockwave terrain smash, and Density enchantment'
}

const forgeManifest: ProjectManifest = {
  id: 'aaaaaaaa-1111-4222-8333-444444444444',
  name: 'Legendary Mace',
  description: 'Legendary Mace',
  type: 'mod',
  platform: 'forge',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T08:00:00.000Z',
  updatedAt: '2026-09-18T08:00:00.000Z',
  features: {
    customItems: true,
    customMobs: false,
    customGuis: false,
    customBlocks: false,
    recipes: true
  },
  schemaVersion: MANIFEST_SCHEMA_VERSION
}

describe('Ollama JSON Schema mirrors Zod failure modes', () => {
  it('expresses every user-hit Zod failure in the JSON Schema (or documents the cross-field gap)', () => {
    const summary = summarizeJsonSchema(OLLAMA_SPEC_JSON_SCHEMA)
    expect(summary.itemsAttributesRequired).toEqual(['id', 'amount'])
    expect(summary.itemsAttributesEnum).toEqual([...ITEM_ATTRIBUTES])
    expect(summary.recipesRequired).toEqual(expect.arrayContaining(['id', 'type', 'resultItemId']))
    expect(summary.recipesPattern).toBe('^[ A-Z#.]{1,3}$')
    expect(summary.commandsRequired).toEqual(['name'])
    expect(summary.unsupportedRequired).toEqual(['feature', 'reason'])
    expect(JSON_SCHEMA_CROSS_FIELD_RULES.length).toBeGreaterThan(0)
    expect(JSON_SCHEMA_CROSS_FIELD_RULES.every((rule) => rule.enforcement.includes('parseProjectSpec'))).toBe(true)
  })

  it('keeps the system prompt aligned with CraftStudio attribute enums and command objects', () => {
    expect(SPEC_SYSTEM_PROMPT).toContain('attack_damage')
    expect(SPEC_SYSTEM_PROMPT).toContain('generic.attackDamage')
    expect(SPEC_SYSTEM_PROMPT).toContain('commands: objects { name, description? }')
    expect(SPEC_SYSTEM_PROMPT).not.toMatch(/commands:\s*names only/i)
    expect(SPEC_SYSTEM_PROMPT).toContain(JSON.stringify(MINIMAL_VALID_SPEC_EXAMPLE))
    expect(parseProjectSpec(MINIMAL_VALID_SPEC_EXAMPLE).items[0]?.attributes[0]?.id).toBe('attack_damage')
  })
})

describe('Legendary Mace regression fixture', () => {
  it('fails Zod on the raw Ollama shape the user observed', () => {
    const raw = projectSpecSchema.safeParse(LEGENDARY_MACE_INVALID_OLLAMA)
    expect(raw.success).toBe(false)
    if (raw.success) {
      return
    }
    const messages = raw.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
    expect(messages).toMatch(/attributes\.0\.id/)
    expect(messages).toMatch(/attributes\.1\.id/)
    expect(messages).toMatch(/attributes\.2\.id/)
    expect(messages).toMatch(/recipes\.0\.resultItemId/)
    expect(messages).toMatch(/recipes\.0\.pattern/)
    expect(messages).toMatch(/commands\.0/)
    expect(messages).toMatch(/unsupportedRequests\.0/)
  })

  it('normalizes documented aliases without swapping breeze_rod', () => {
    const normalized = normalizeSpecDraft(LEGENDARY_MACE_INVALID_OLLAMA) as {
      items: { attributes: { id: string }[] }[]
      recipes: { resultItemId: string; pattern: string[]; keys: { id: string }[] }[]
      commands: { name: string }[]
      unsupportedRequests: { feature: string }[]
    }
    expect(normalized.items[0]?.attributes[0]?.id).toBe('attack_damage')
    expect(normalized.items[0]?.attributes[1]?.id).toBe('attack_speed')
    expect(normalized.recipes[0]?.resultItemId).toBe('legendary_mace')
    expect(normalized.recipes[0]?.pattern).toEqual([' B ', ' S ', ' S '])
    expect(normalized.recipes[0]?.keys.map((key) => key.id)).toEqual([
      'minecraft:breeze_rod',
      'minecraft:stick'
    ])
    expect(normalized.commands[0]?.name).toBe('givemace')
    expect(normalized.unsupportedRequests[0]?.feature).toBe('life steal')
    expect(() => parseProjectSpec(normalized)).toThrow(/allowlist/)
  })

  it('parses a corrected spec and emits Forge files without claiming mace smash', () => {
    const spec = parseProjectSpec(LEGENDARY_MACE_CORRECTED)
    expect(spec.items[0]?.attributes.map((attr) => attr.id)).toEqual(['attack_damage', 'attack_speed'])
    expect(spec.unsupportedRequests.some((item) => item.feature === 'mace combat')).toBe(true)
    const fromPrompt = collectUnsupportedFromPrompt(LEGENDARY_MACE_CORRECTED.prompt)
    expect(fromPrompt.map((item) => item.feature)).toEqual(
      expect.arrayContaining(['mace combat', 'life steal', 'shockwave / terrain', 'enchantments'])
    )
    const files = planForgeFiles(forgeManifest, spec)
    const java = files.find((file) => file.relativePath.endsWith('LegendaryMace.java'))?.contents.toString() ?? ''
    expect(java).toContain('legendary_mace')
    expect(java).toContain('Attributes.ATTACK_DAMAGE')
    expect(java).toContain('literal("givemace")')
    expect(java).not.toMatch(/smash|lifesteal|life steal|shockwave|Density|Breach/i)
    const recipe =
      files.find((file) => file.relativePath.endsWith('recipe/legendary_mace_shaped.json'))?.contents.toString() ?? ''
    expect(recipe).toContain('minecraft:iron_ingot')
    expect(recipe).toContain('minecraft:stick')
    expect(recipe).not.toContain('breeze_rod')
  })
})

describe('outgoing /api/chat format payload', () => {
  it('sends a complete format object, not a json-schema label', async () => {
    let body: Record<string, unknown> = {}
    globalThis.fetch = vi.fn(async (_url, init) => {
      body = JSON.parse(String((init as RequestInit | undefined)?.body)) as Record<string, unknown>
      const line = `${JSON.stringify({ message: { content: '{"ok":true}' } })}\n`
      return new Response(line, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } })
    }) as typeof fetch

    const service = new OllamaService()
    await service.chatJson({
      endpoint: 'http://localhost:11434',
      model: 'qwen2.5-coder:7b',
      timeoutMs: 2000,
      numPredict: 32,
      numCtx: 512,
      format: OLLAMA_SPEC_JSON_SCHEMA,
      messages: [{ role: 'user', content: 'spec' }]
    })

    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain('/api/chat')
    expect(body.format).not.toBe('json')
    expect(body.format).not.toBe('json-schema')
    const format = body.format as Record<string, unknown>
    const redacted = summarizeJsonSchema(format)
    expect(redacted.propertyKeys).toEqual(
      expect.arrayContaining(['items', 'recipes', 'commands', 'unsupportedRequests', 'blocks', 'mobs'])
    )
    expect(redacted.itemsAttributesRequired).toEqual(['id', 'amount'])
    expect(redacted.itemsAttributesEnum).toEqual([...ITEM_ATTRIBUTES])
    expect(redacted.recipesRequired).toEqual(expect.arrayContaining(['resultItemId']))
    expect(redacted.recipesPattern).toBe('^[ A-Z#.]{1,3}$')
    expect(redacted.commandsRequired).toEqual(['name'])
    expect(redacted.unsupportedRequired).toEqual(['feature', 'reason'])
    const attributesItems = (
      ((format.properties as Record<string, unknown>).items as Record<string, unknown>).items as Record<
        string,
        unknown
      >
    ).properties as Record<string, unknown>
    expect((attributesItems.attributes as { items?: unknown }).items).toEqual(
      expect.objectContaining({ required: ['id', 'amount'] })
    )
  })
})
