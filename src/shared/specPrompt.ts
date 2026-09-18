import { ITEM_ATTRIBUTES } from './itemStats'
import { VANILLA_ITEMS } from './spec'

export const MINIMAL_VALID_SPEC_EXAMPLE = {
  schemaVersion: 1,
  modId: 'example_mod',
  displayName: 'Example Mod',
  description: 'A simple custom item.',
  packageName: 'local.craftstudio.example_mod',
  mainClass: 'ExampleMod',
  items: [
    {
      id: 'copper_rod',
      displayName: 'Copper Rod',
      description: 'A handheld rod.',
      maxCount: 1,
      rarity: 'common',
      modelStyle: 'handheld',
      durability: 80,
      attributes: [{ id: 'attack_damage', amount: 3, slot: 'mainhand' }]
    }
  ],
  recipes: [
    {
      id: 'copper_rod_shaped',
      type: 'shaped',
      resultItemId: 'copper_rod',
      resultCount: 1,
      ingredients: [],
      pattern: [' C ', ' C ', ' S '],
      keys: [
        { symbol: 'C', kind: 'vanilla', id: 'minecraft:copper_ingot' },
        { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
      ]
    }
  ],
  commands: [{ name: 'givecopperrod', description: 'Name only; implementation is a stub on mods.' }],
  unsupportedRequests: [
    {
      feature: 'life steal',
      reason: 'No on-hit healing effect is generated. Schema-valid is not the same as implemented.'
    }
  ],
  source: 'ollama',
  prompt: 'copper rod'
} as const

export const SPEC_SYSTEM_PROMPT = `You emit ONLY one JSON object that matches the CraftStudio Local spec schema.
Rules:
- schemaVersion must be 1. source must be "ollama". packageName like local.craftstudio.mod_id. mainClass PascalCase.
- items: 1-8. id lowercase [a-z0-9_], starts with a letter.
- Item attributes are objects { id, amount, slot? }. id MUST be one of: ${ITEM_ATTRIBUTES.join(', ')}.
- NEVER emit Minecraft API names (generic.attackDamage, generic.attack_damage, GENERIC_ATTACK_DAMAGE, ATTACK_DAMAGE). Use the CraftStudio enums above.
- recipes: shapeless uses ingredients[{kind,id}]. shaped uses pattern (1-3 rows, each 1-3 of space/A-Z/#/.) AND keys[{symbol,kind,id}]. symbol is one A-Z letter. resultItemId is a spec item id, not a minecraft: id.
- Vanilla ingredient ids must be from this allowlist: ${VANILLA_ITEMS.join(', ')}. If the user asked for something else (breeze_rod, netherite_ingot, …), keep that request in unsupportedRequests. Do not substitute iron_ingot or another item.
- commands: objects { name, description? }, not bare strings. Names are stubbed (registered as a literal on Fabric/Forge/NeoForge/Paper when possible). They are not a command engine.
- unsupportedRequests: objects { feature, reason }, not bare strings. Use this for mace smash/Density/Breach, life steal, shockwaves, terrain edits, custom enchantments, AI-drawn textures, dimensions, behavior trees.
- Schema-valid JSON is not an implemented feature. Do not claim those gaps are done.
- Never include file paths, shell commands, Gradle, or Java source.

Minimal valid example:
${JSON.stringify(MINIMAL_VALID_SPEC_EXAMPLE)}`

export const SPEC_REPAIR_CONSTRAINTS = `Constraints (must match Zod + OLLAMA_SPEC_JSON_SCHEMA):
- attributes.id must be one of: ${ITEM_ATTRIBUTES.join(', ')}. Never generic.attackDamage / generic.attack_damage / GENERIC_*.
- attributes are objects {id, amount, slot?} — both id and amount are required.
- recipes need resultItemId (spec item id). shaped pattern rows are 1–3 of [ A-Z#.]; keys are [{symbol,kind,id}] with symbol A–Z.
- commands are objects {name, description?}, not strings.
- unsupportedRequests are objects {feature, reason}, not strings.
- Do not swap off-allowlist ingredients. Keep the asked id and add unsupportedRequests.
- Cross-field rules Zod still checks: resultItemId exists in items; pattern letters match keys; vanilla allowlist; durability requires maxCount 1.`