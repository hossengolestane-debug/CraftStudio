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
    pattern: /\b(mob|entity|entities|boss|golem)\b/i,
    feature: 'custom entities',
    reason: 'Phase 2 does not emit entity/mob code. Items and shapeless recipes only.'
  },
  {
    pattern: /\b(gui|screen|inventory menu|container)\b/i,
    feature: 'custom GUIs',
    reason: 'GUI editors are not in Phase 2.'
  },
  {
    pattern: /\b(dimension|biome|worldgen|ore gen|structure)\b/i,
    feature: 'worldgen',
    reason: 'World generation is not emitted in Phase 2.'
  },
  {
    pattern: /\b(custom block|new block|ore block)\b/i,
    feature: 'custom blocks',
    reason: 'Block registration is not part of the Phase 2 Fabric slice.'
  },
  {
    pattern: /\btexture\s+pack|paint texture|pixel art\b/i,
    feature: 'texture editor',
    reason: 'No texture painter. A placeholder item model is used.'
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
  const unsupportedRequests = UNSUPPORTED_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => ({
    feature: entry.feature,
    reason: entry.reason
  }))

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
    unsupportedRequests,
    source: 'template',
    prompt: text
  })
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
