import { defaultMob, defaultModGui, defaultPluginGui } from './defaults'
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
    reason: 'Phase 7 emits five movement presets only. Full behavior trees are out of scope.'
  },
  {
    pattern: /\b(dimension|worldgen|ore gen|structure)\b/i,
    feature: 'worldgen',
    reason: 'Full world generation is not emitted. Dedicated biome spawn tables are a separate Phase 7 MVP.'
  },
  {
    pattern: /\b(custom block|new block|ore block)\b/i,
    feature: 'custom blocks',
    reason: 'Block registration is not part of the Phase 7 slice.'
  }
]

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
  const wantsRecipe = /\b(recipe|craft|crafting|shapeless)\b/i.test(text)
  const wantsMob = /\b(mob|entity|entities|creature)\b/i.test(text)
  const wantsGui = /\b(gui|screen|inventory menu|container|menu)\b/i.test(text)
  const wantsSpawn = /\b(spawn|spawns in|biome spawn)\b/i.test(text)
  const unsupportedRequests = UNSUPPORTED_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => ({
    feature: entry.feature,
    reason: entry.reason
  }))
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
        rarity: 'common'
      }
    ],
    recipes: wantsRecipe
      ? [
          {
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
    unsupportedRequests,
    source: 'template',
    prompt: text
  })
}

function inferMobPreset(text: string): ReturnType<typeof defaultMob>['preset'] {
  if (/\b(lookout|sentry|stationary|guard)\b/i.test(text)) {
    return 'stationary_lookout'
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
