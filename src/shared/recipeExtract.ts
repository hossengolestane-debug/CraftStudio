import { isVanillaItemId, normalizeVanillaId } from './vanillaRegistry'

export interface ExtractedRecipeKey {
  symbol: string
  kind: 'vanilla' | 'mod'
  id: string
}

export interface ExtractedShapedRecipe {
  pattern: string[]
  keys: ExtractedRecipeKey[]
}

const KEY_LINE =
  /(?:^|[,\s])([A-Za-z])\s*=\s*(minecraft:[a-z0-9_]+|[a-z][a-z0-9_]{1,30})/g

function normalizeRow(row: string): string {
  const trimmed = row.trim().replace(/[·•]/g, '.')
  if (/^(?:[A-Za-z#.]\s+){1,2}[A-Za-z#.]$/.test(trimmed)) {
    return trimmed.replace(/\s+/g, '').replace(/[a-z]/g, (ch) => ch.toUpperCase())
  }
  return trimmed
    .replace(/[^ A-Za-z#.]/g, ' ')
    .replace(/[a-z]/g, (ch) => ch.toUpperCase())
    .slice(0, 3)
}

function looksLikePatternRow(row: string): boolean {
  const normalized = normalizeRow(row.trim())
  return /^[ A-Z#.]{1,3}$/.test(normalized) && /[A-Z#.]/.test(normalized)
}

export function extractShapedRecipeFromPrompt(text: string): ExtractedShapedRecipe | null {
  const keys = extractKeys(text)
  if (keys.length === 0) {
    return null
  }
  const pattern = extractPattern(text, new Set(keys.map((key) => key.symbol)))
  if (pattern.length === 0) {
    return null
  }
  const used = new Set(pattern.join('').replace(/[^A-Z]/g, '').split(''))
  const filtered = keys.filter((key) => used.has(key.symbol))
  if (filtered.length === 0) {
    return null
  }
  return { pattern, keys: filtered }
}

function extractKeys(text: string): ExtractedRecipeKey[] {
  const keys: ExtractedRecipeKey[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(KEY_LINE)) {
    const symbol = match[1]!.toUpperCase()
    const rawId = match[2]!
    if (seen.has(symbol)) {
      continue
    }
    seen.add(symbol)
    const id = rawId.startsWith('minecraft:') ? normalizeVanillaId(rawId) : rawId
    keys.push({
      symbol,
      kind: id.startsWith('minecraft:') ? 'vanilla' : 'mod',
      id
    })
  }
  return keys
}

function extractPattern(text: string, symbols: Set<string>): string[] {
  const slash = text.match(
    /(?:pattern|shape)\s*[:=]\s*([A-Za-z#. ]{1,3})\s*\/\s*([A-Za-z#. ]{1,3})\s*\/\s*([A-Za-z#. ]{1,3})/i
  )
  if (slash) {
    return padRows([slash[1]!, slash[2]!, slash[3]!].map(normalizeRow))
  }

  const lines = text.split(/\r?\n/)
  const rows: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!looksLikePatternRow(trimmed)) {
      if (rows.length > 0) {
        break
      }
      continue
    }
    const normalized = normalizeRow(trimmed)
    const letters = normalized.replace(/[^A-Z]/g, '')
    if (letters.length > 0 && ![...letters].every((ch) => symbols.has(ch))) {
      if (rows.length === 0) {
        continue
      }
      break
    }
    rows.push(normalized)
    if (rows.length === 3) {
      break
    }
  }
  return rows.length > 0 ? padRows(rows) : []
}

function padRows(rows: string[]): string[] {
  const width = Math.min(3, Math.max(1, ...rows.map((row) => row.length)))
  return rows.map((row) => row.padEnd(width, ' ').slice(0, width))
}

export function recipeUsesUnknownVanilla(keys: ExtractedRecipeKey[]): string[] {
  return keys
    .filter((key) => key.kind === 'vanilla' && !isVanillaItemId(key.id))
    .map((key) => key.id)
}
