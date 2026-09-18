import { defaultBlock } from './blocks'
import { defaultMob, defaultModGui, defaultPluginGui } from './defaults'
import { defaultSpring, defaultSurfacePatch, defaultWorldgen } from './worldgen'
import type { ProjectManifest } from './types'
import {
  parseProjectSpec,
  toMainClass,
  toModId,
  toPackageName,
  type ProjectSpec
} from './spec'

const UNSUPPORTED_PATTERNS: { pattern: RegExp; feature: string; reason: string }[] = [
  {
    pattern: /\b(boss|golem|behavior tree|pathfinding tree)\b/i,
    feature: 'advanced entities',
    reason: 'Phase 10 emits a capped goal list (max 5) with optional priorities. Full behavior trees are out of scope.'
  },
  {
    pattern: /\b(dimension|nether dimension|end dimension|custom structure|jigsaw)\b/i,
    feature: 'worldgen stack',
    reason: 'Phase 10 emits ore-vein, surface-patch, and spring features only. Dimensions and structures stay unsupported.'
  },
  {
    pattern: /\b(mace|smash attack|density|breach enchantment|wind charge smash)\b/i,
    feature: 'mace combat',
    reason: 'CraftStudio items are generic custom items with optional attack_damage / attack_speed. 1.21 mace smash, Density, and Breach are not emitted.'
  },
  {
    pattern: /\b(life ?steal|lifesteal|leech health)\b/i,
    feature: 'life steal',
    reason: 'No custom on-hit healing effect is generated.'
  },
  {
    pattern: /\b(shockwave|quake|terrain smash|break blocks on hit)\b/i,
    feature: 'shockwave / terrain',
    reason: 'No area damage or terrain modification is generated.'
  },
  {
    pattern: /\b(enchantment|enchanted with|custom enchant)\b/i,
    feature: 'enchantments',
    reason: 'Custom enchantments are not registered. This is not a completed enchantment implementation.'
  },
  {
    pattern: /\b(ai texture|generated texture|paint a png|dall-e|image model)\b/i,
    feature: 'generated textures',
    reason: 'Ollama does not draw PNGs. Paint textures on the Assets tab.'
  }
]

export function collectUnsupportedFromPrompt(text: string): { feature: string; reason: string }[] {
  return UNSUPPORTED_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => ({
    feature: entry.feature,
    reason: entry.reason
  }))
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function extractQuotedName(prompt: string): string | null {
  const quoted = prompt.match(/["“]([^"”]{2,40})["”]/)
  if (quoted?.[1]) {
    return quoted[1]
  }
  const called = prompt.match(/\b(?:called|named)\s+([a-z0-9][a-z0-9 _-]{1,32}?)(?:\s+and\b|[.,]|$)/i)
  if (called?.[1]) {
    return called[1].trim()
  }
  return null
}

export function inferSpecFromPrompt(manifest: ProjectManifest, prompt: string): ProjectSpec {
  const text = prompt.trim() || manifest.description || manifest.name
  const itemName = extractQuotedName(text) ?? manifest.name
  const itemId = (toModId(itemName).replace(/^m(?=\d)/, '') || 'custom_item').slice(0, 24)
  const wantsRecipe = /\b(recipe|craft|crafting|shapeless|shaped)\b/i.test(text)
  const wantsShaped = /\bshaped\b/i.test(text)
  const wantsMob = /\b(mob|entity|entities|creature)\b/i.test(text)
  const wantsGui = /\b(gui|screen|inventory menu|container|menu)\b/i.test(text)
  const wantsSpawn = /\b(spawn|spawns in|biome spawn)\b/i.test(text)
  const wantsOre = /\b(ore|vein|ore gen|worldgen)\b/i.test(text)
  const wantsPatch = /\b(flower patch|random patch|surface patch|wildflower)\b/i.test(text)
  const wantsSpring = /\b(spring|water spring|lava spring|geyser)\b/i.test(text)
  const wantsBlock = /\b(custom block|new block|ore block|stone block|pillar|slab|stairs)\b/i.test(text)
  const wantsPillar = /\b(pillar|column|axis block|log.?shaped)\b/i.test(text)
  const wantsSlabStairs = /\b(slab|stairs|stair)\b/i.test(text)
  const unsupportedRequests = collectUnsupportedFromPrompt(text)
  if (wantsMob && (manifest.platform === 'paper' || manifest.platform === 'spigot')) {
    unsupportedRequests.push({
      feature: 'new client entity types',
      reason: `${manifest.platform} can only disguise existing vanilla mobs. Clients do not see a new entity type.`
    })
  }
  if (wantsSpawn && (manifest.platform === 'paper' || manifest.platform === 'spigot')) {
    unsupportedRequests.push({
      feature: 'biome spawn tables',
      reason: `${manifest.platform} cannot register biome spawn tables. Custom mobs stay summon/command disguises.`
    })
  }
  if ((wantsOre || wantsPatch || wantsSpring) && (manifest.platform === 'paper' || manifest.platform === 'spigot')) {
    unsupportedRequests.push({
      feature: 'worldgen',
      reason: `${manifest.platform} cannot emit configured/placed features. This is an honest gap, not fake worldgen.`
    })
  }
  if (wantsBlock && (manifest.platform === 'paper' || manifest.platform === 'spigot')) {
    unsupportedRequests.push({
      feature: 'custom blocks',
      reason: `${manifest.platform} cannot register a new block id. CraftStudio will not disguise a vanilla block as a custom type.`
    })
  }

  return parseProjectSpec({
    schemaVersion: 1,
    modId: toModId(manifest.name),
    displayName: manifest.name,
    description: manifest.description || text,
    packageName: toPackageName(toModId(manifest.name)),
    mainClass: toMainClass(manifest.name),
    items: [
      {
        id: itemId,
        displayName: titleCase(itemName),
        description: text.slice(0, 400),
        maxCount: 64,
        rarity: 'common',
        durability: 0,
        attributes: []
      }
    ],
    recipes: wantsRecipe
      ? [
          wantsShaped
            ? {
                id: `${itemId.slice(0, 18)}_shaped`,
                type: 'shaped',
                resultItemId: itemId,
                resultCount: 1,
                ingredients: [],
                pattern: [' X ', ' X ', ' S '],
                keys: [
                  { symbol: 'X', kind: 'vanilla', id: 'minecraft:iron_ingot' },
                  { symbol: 'S', kind: 'vanilla', id: 'minecraft:stick' }
                ]
              }
            : {
                id: `${itemId.slice(0, 18)}_cobble`,
                type: 'shapeless',
                resultItemId: itemId,
                resultCount: 1,
                ingredients: [{ kind: 'vanilla', id: 'minecraft:cobblestone' }]
              }
        ]
      : [],
    commands: [],
    mobs: wantsMob
      ? [
          {
            ...defaultMob(`${itemId.slice(0, 20)}_mob`),
            displayName: `${titleCase(itemName)} Mob`,
            preset: inferMobPreset(text),
            spawn:
              wantsSpawn && manifest.type === 'mod'
                ? { enabled: true, biomes: ['plains'], weight: 8, minGroup: 1, maxGroup: 2 }
                : defaultMob().spawn
          }
        ]
      : [],
    modGuis: wantsGui && manifest.type === 'mod' ? [defaultModGui()] : [],
    pluginGuis: wantsGui && manifest.type === 'plugin' ? [defaultPluginGui()] : [],
    blocks:
      wantsBlock && manifest.type === 'mod'
        ? [
            {
              ...defaultBlock(`${itemId.slice(0, 16)}_block`),
              displayName: `${titleCase(itemName)} Block`,
              shape: wantsPillar ? 'pillar' : 'cube_all',
              slab: wantsSlabStairs,
              stairs: wantsSlabStairs
            }
          ]
        : [],
    worldgen:
      manifest.type === 'mod'
        ? [
            ...(wantsOre ? [defaultWorldgen(`${itemId.slice(0, 16)}_vein`)] : []),
            ...(wantsPatch ? [defaultSurfacePatch(`${itemId.slice(0, 14)}_patch`)] : []),
            ...(wantsSpring ? [defaultSpring(`${itemId.slice(0, 14)}_spring`)] : [])
          ]
        : [],
    unsupportedRequests,
    source: 'template',
    prompt: text
  })
}

function inferMobPreset(text: string): ReturnType<typeof defaultMob>['preset'] {
  if (/\b(lookout|sentry|stationary|guard)\b/i.test(text)) {
    return 'stationary_lookout'
  }
  if (/\b(follow player|follows players|companion)\b/i.test(text)) {
    return 'follow_player'
  }
  if (/\b(leap|pounce|jump attack)\b/i.test(text)) {
    return 'leap_melee'
  }
  if (/\b(avoid players|skittish|shy)\b/i.test(text)) {
    return 'avoid_players'
  }
  if (/\b(hostile|zombie|attack|melee)\b/i.test(text)) {
    return 'hostile_melee'
  }
  if (/\b(flee|neutral)\b/i.test(text)) {
    return 'neutral_flee'
  }
  return 'passive_wanderer'
}

export function promptLooksComplex(prompt: string): boolean {
  const text = prompt.trim()
  if (text.length > 280) {
    return true
  }
  if (UNSUPPORTED_PATTERNS.some((entry) => entry.pattern.test(text))) {
    return true
  }
  return /\b(and also|plus|several|multiple items|enchant|effect|potion|armor|tool)\b/i.test(text)
}
