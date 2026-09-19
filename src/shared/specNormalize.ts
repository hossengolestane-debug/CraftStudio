import { normalizeAttributeId } from './itemStats'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function slugIdent(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'c$1')
    .slice(0, 31)
  return slug.length >= 2 ? slug : 'cmd_name'
}

function ingredientKind(id: string): 'vanilla' | 'mod' {
  return id.startsWith('minecraft:') ? 'vanilla' : 'mod'
}

function readId(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (isRecord(value)) {
    if (typeof value.id === 'string') {
      return value.id.trim()
    }
    if (typeof value.item === 'string') {
      return value.item.trim()
    }
  }
  return ''
}

function normalizePatternRow(row: unknown): string {
  if (Array.isArray(row)) {
    return row
      .map((cell) => {
        if (cell === '.' || cell === '#') {
          return String(cell)
        }
        if (typeof cell === 'string' && /^[A-Za-z]$/.test(cell)) {
          return cell.toUpperCase()
        }
        return ' '
      })
      .join('')
      .slice(0, 3)
  }
  if (typeof row !== 'string') {
    return ''
  }
  return row
    .replace(/[^ A-Za-z#.]/g, ' ')
    .replace(/[a-z]/g, (ch) => ch.toUpperCase())
    .slice(0, 3)
}

function padPattern(rows: string[]): string[] {
  const limited = rows.filter((row) => row.length > 0).slice(0, 3)
  const width = Math.min(3, Math.max(1, ...limited.map((row) => row.length), 0))
  return limited.map((row) => row.padEnd(width, ' ').slice(0, width))
}

function normalizeKeys(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => {
      if (!isRecord(entry)) {
        return entry
      }
      const symbol = typeof entry.symbol === 'string' ? entry.symbol : typeof entry.key === 'string' ? entry.key : ''
      const id = readId(entry.item ?? entry.id ?? entry)
      return {
        symbol: symbol.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1),
        kind: entry.kind === 'mod' || ingredientKind(id) === 'mod' ? 'mod' : 'vanilla',
        id
      }
    })
  }
  if (!isRecord(raw)) {
    return []
  }
  return Object.entries(raw).map(([symbol, value]) => {
    const id = readId(value)
    return {
      symbol: symbol.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1),
      kind: ingredientKind(id),
      id
    }
  })
}

function normalizeAttributes(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: unknown[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue
    }
    const idRaw = typeof entry.id === 'string' ? entry.id : typeof entry.attribute === 'string' ? entry.attribute : ''
    const id = normalizeAttributeId(idRaw)
    const amount = typeof entry.amount === 'number' ? entry.amount : typeof entry.value === 'number' ? entry.value : undefined
    if (!id || amount === undefined) {
      out.push(entry)
      continue
    }
    out.push({
      id,
      amount,
      slot: typeof entry.slot === 'string' ? entry.slot : 'mainhand'
    })
  }
  return out
}

function normalizeCommands(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((entry) => {
    if (typeof entry === 'string') {
      return { name: slugIdent(entry), description: '' }
    }
    if (!isRecord(entry)) {
      return entry
    }
    const nameRaw =
      typeof entry.name === 'string'
        ? entry.name
        : typeof entry.command === 'string'
          ? entry.command
          : typeof entry.id === 'string'
            ? entry.id
            : ''
    return {
      name: slugIdent(nameRaw),
      description: typeof entry.description === 'string' ? entry.description : '',
      permission: typeof entry.permission === 'string' ? entry.permission : undefined
    }
  })
}

function normalizeUnsupported(raw: unknown): { feature: string; reason: string }[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((entry) => {
    if (typeof entry === 'string') {
      return { feature: entry.slice(0, 80) || 'request', reason: 'Requested without a structured reason.' }
    }
    if (!isRecord(entry)) {
      return { feature: 'request', reason: 'Requested without a structured reason.' }
    }
    const feature =
      typeof entry.feature === 'string'
        ? entry.feature
        : typeof entry.name === 'string'
          ? entry.name
          : 'request'
    const reason =
      typeof entry.reason === 'string'
        ? entry.reason
        : typeof entry.message === 'string'
          ? entry.message
          : 'Requested without a structured reason.'
    return { feature: feature.slice(0, 80), reason: reason.slice(0, 400) }
  })
}

function normalizeRecipe(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return raw
  }
  const resultRaw = raw.resultItemId ?? raw.result_item_id ?? raw.resultItem ?? raw.result
  let resultItemId = ''
  if (typeof resultRaw === 'string') {
    resultItemId = resultRaw.replace(/^.*:/, '')
  } else if (isRecord(resultRaw)) {
    resultItemId = readId(resultRaw).replace(/^.*:/, '')
  }
  const patternRaw = raw.pattern
  const pattern = Array.isArray(patternRaw)
    ? padPattern(patternRaw.map(normalizePatternRow))
    : typeof patternRaw === 'string'
      ? padPattern(patternRaw.split(/\n/).map(normalizePatternRow))
      : []
  const keys = normalizeKeys(raw.keys ?? raw.key)
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.map((entry) => {
        const id = readId(isRecord(entry) ? (entry.id ?? entry.item ?? entry) : entry)
        return {
          kind: isRecord(entry) && entry.kind === 'mod' ? 'mod' : ingredientKind(id),
          id
        }
      })
    : []
  return {
    ...raw,
    id: raw.id,
    type: raw.type === 'shaped' || pattern.length > 0 ? 'shaped' : 'shapeless',
    resultItemId: resultItemId || raw.resultItemId,
    resultCount: raw.resultCount ?? 1,
    ingredients,
    pattern,
    keys
  }
}

/**
 * Deterministic, documented aliases only. Does not invent gameplay or swap ingredients.
 */
export function normalizeSpecDraft(input: unknown): unknown {
  if (!isRecord(input)) {
    return input
  }
  const unsupported = normalizeUnsupported(input.unsupportedRequests)
  const items = Array.isArray(input.items)
    ? input.items.map((item) => {
        if (!isRecord(item)) {
          return item
        }
        return {
          ...item,
          attributes: normalizeAttributes(item.attributes)
        }
      })
    : input.items
  const recipes = Array.isArray(input.recipes)
    ? input.recipes.map((recipe) => normalizeRecipe(recipe))
    : input.recipes
  return {
    ...input,
    items,
    recipes,
    commands: normalizeCommands(input.commands),
    unsupportedRequests: unsupported
  }
}
