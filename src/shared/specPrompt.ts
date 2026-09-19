import { ITEM_ATTRIBUTES } from './itemStats'

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
      feature: 'behavior trees',
      reason: 'Full behavior trees are out of scope. Schema-valid is not the same as implemented.'
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
- Vanilla ingredient ids must exist in the 1.21.1 item registry (including netherite_ingot, heavy_core, breeze_rod, enchanted_golden_apple, netherite_sword). If the user asked for an unknown id, keep that id and record unsupportedRequests. NEVER substitute iron_ingot, stick, or another item.
- Preserve the exact shaped pattern and keys the user wrote. Do not invent a default sword recipe.
- "Affects hostile mobs" is a combat filter. Do NOT create a custom mob, entity, or *_mob entry unless the user explicitly asked to add/create a mob.
- Chest loot, worldgen, and other optional systems stay off (enableChestLoot=false, enableWorldgen=false) unless the user explicitly asked for them.
- items[].weapon is the reusable combat object: smash, enchantments[{id,level}], lifeSteal{enabled,percent,capHealth,hostileOnly}, shockwave{enabled,minFallBlocks,cooldownSeconds,radius,damage,upwardImpulse}, terrain{enabled,radius,maxBlocks}, textureStyle.
- When the user asks for a custom item texture, textureStyle must be netherite_mace or generic_weapon — never "none".
- For a 1.21.1 mace, record the highest mutually compatible enchantments (Density 5, Wind Burst 3, Fire Aspect 2, Unbreaking 3, Mending 1). Density and Breach cannot coexist; prefer Density. Do not emit only Fire Aspect II.
- For Forge 1.21.1, those weapon fields are generated as executable Java. Put only truly unimplemented asks (dimensions, behavior trees, DALL-E textures) in unsupportedRequests.
- commands: objects { name, description? }, not bare strings. Names are stubbed (registered as a literal on Fabric/Forge/NeoForge/Paper when possible). They are not a command engine.
- unsupportedRequests: objects { feature, reason }, not bare strings.
- Schema-valid JSON is not an implemented feature. Do not claim unimplemented abilities are working.
- Never include file paths, shell commands, Gradle, or Java source.

Minimal valid example:
${JSON.stringify(MINIMAL_VALID_SPEC_EXAMPLE)}`

export const SPEC_REPAIR_CONSTRAINTS = `Constraints (must match Zod + OLLAMA_SPEC_JSON_SCHEMA):
- attributes.id must be one of: ${ITEM_ATTRIBUTES.join(', ')}. Never generic.attackDamage / generic.attack_damage / GENERIC_*.
- attributes are objects {id, amount, slot?} — both id and amount are required.
- recipes need resultItemId (spec item id). shaped pattern rows are 1–3 of [ A-Z#.]; keys are [{symbol,kind,id}] with symbol A–Z.
- commands are objects {name, description?}, not strings.
- unsupportedRequests are objects {feature, reason}, not strings.
- Do not swap unknown ingredients. Keep the asked id and add unsupportedRequests.
- Do not add mobs or chest loot the user did not ask to create.
- items[].weapon carries smash / life steal / shockwave / terrain / enchantments when requested.
- Cross-field rules Zod still checks: resultItemId exists in items; pattern letters match keys; 1.21.1 registry ingredients; durability requires maxCount 1.`