/** Acceptance-case request. Not a hardcoded generator special-case. */
export const LEGENDARY_MACE_REQUEST = `Create a Forge 1.21.1 weapon called "Legendary Mace".

Recipe shape:
A H A
. N .
. S .
Keys: A=minecraft:enchanted_golden_apple, H=minecraft:heavy_core, N=minecraft:netherite_ingot, S=minecraft:netherite_sword, .=empty
Output: one Legendary Mace.

Combat: mace smash. Enchant the crafted item with compatible mace enchantments Density 3 and Breach 2.
Direct-hit Life Steal: 20% of actual health damage, capped at 4 health points, respecting max health.
Affects hostile mobs only. Exclude players and passive mobs. Do not create a custom mob.
Smash-triggered shockwave after a fall of at least 3 blocks. Per-wielder cooldown 10 seconds.
Radius 6 blocks, 8 damage to other eligible targets, upward impulse 1.0 blocks/tick.
Particles, sound, cooldown feedback. Prevent recursive activation and shockwave Life Steal. Server-authoritative.

Bounded terrain: radius 3 blocks; at most one surface block per column; max 24 blocks total.
Allow only dirt, grass_block, stone, sand, gravel. Exclude block entities and fluids; no block drops.
Config toggle that disables terrain destruction while retaining the shockwave.

Texture: original 32×32 transparent PNG. Dark netherite handle, metallic head, gold edging, purple cracks around a golden core. Package the file and item-model references. Do not use an entity texture.

Chest loot stays disabled. IMPLEMENTATION AND VERIFICATION must keep this full request, including this IMPLEMENTATION AND VERIFICATION sentence, without mid-word truncation.`

export const LEGENDARY_MACE_FIXTURE_SPEC = {
  schemaVersion: 1,
  modId: 'legendary_mace',
  displayName: 'Legendary Mace',
  description: 'Create a Forge 1.21.1 weapon called "Legendary Mace".',
  packageName: 'local.craftstudio.legendary_mace',
  mainClass: 'LegendaryMace',
  items: [
    {
      id: 'legendary_mace',
      displayName: 'Legendary Mace',
      description: 'Create a Forge 1.21.1 weapon called "Legendary Mace".',
      maxCount: 1,
      rarity: 'epic' as const,
      modelStyle: 'handheld' as const,
      durability: 500,
      attributes: [
        { id: 'attack_damage' as const, amount: 8, slot: 'mainhand' as const },
        { id: 'attack_speed' as const, amount: -2.4, slot: 'mainhand' as const }
      ],
      weapon: {
        smash: true,
        enchantments: [
          { id: 'minecraft:density', level: 5 },
          { id: 'minecraft:wind_burst', level: 3 },
          { id: 'minecraft:fire_aspect', level: 2 },
          { id: 'minecraft:unbreaking', level: 3 },
          { id: 'minecraft:mending', level: 1 }
        ],
        lifeSteal: { enabled: true, percent: 0.2, capHealth: 4, hostileOnly: true },
        shockwave: {
          enabled: true,
          minFallBlocks: 3,
          cooldownSeconds: 10,
          radius: 6,
          damage: 8,
          upwardImpulse: 1
        },
        terrain: {
          enabled: true,
          radius: 3,
          maxBlocks: 24,
          allowBlocks: [
            'minecraft:dirt',
            'minecraft:grass_block',
            'minecraft:stone',
            'minecraft:sand',
            'minecraft:gravel'
          ]
        },
        textureStyle: 'netherite_mace' as const
      }
    }
  ],
  recipes: [
    {
      id: 'legendary_mace_shaped',
      type: 'shaped' as const,
      resultItemId: 'legendary_mace',
      resultCount: 1,
      ingredients: [],
      pattern: ['AHA', '.N.', '.S.'],
      keys: [
        { symbol: 'A', kind: 'vanilla' as const, id: 'minecraft:enchanted_golden_apple' },
        { symbol: 'H', kind: 'vanilla' as const, id: 'minecraft:heavy_core' },
        { symbol: 'N', kind: 'vanilla' as const, id: 'minecraft:netherite_ingot' },
        { symbol: 'S', kind: 'vanilla' as const, id: 'minecraft:netherite_sword' }
      ]
    }
  ],
  commands: [],
  mobs: [],
  unsupportedRequests: [],
  source: 'template' as const,
  prompt: LEGENDARY_MACE_REQUEST,
  config: {
    enableWorldgen: false,
    enableChestLoot: false,
    spawnWeightScale: 1,
    enableTerrainDestruction: true
  }
}
