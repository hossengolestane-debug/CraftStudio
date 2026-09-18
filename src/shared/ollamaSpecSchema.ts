/** Cross-field Zod rules JSON Schema cannot express. Enforced in parseProjectSpec + prompt + repair. */
export const JSON_SCHEMA_CROSS_FIELD_RULES = [
  {
    rule: 'recipes[].resultItemId must match an items[].id',
    jsonSchema: 'not expressible across sibling arrays without a custom vocabulary',
    enforcement: 'parseProjectSpec + SPEC_SYSTEM_PROMPT + repair field errors'
  },
  {
    rule: 'shaped pattern letters must match keys[].symbol; unused keys rejected',
    jsonSchema: 'not expressible as a local pattern/key correspondence',
    enforcement: 'parseProjectSpec + SPEC_SYSTEM_PROMPT + repair field errors'
  },
  {
    rule: 'shaped pattern rows must share the same 1–3 width',
    jsonSchema: 'JSON Schema can constrain each row regex, not equal widths',
    enforcement: 'parseProjectSpec + padPattern normalize + repair'
  },
  {
    rule: 'vanilla ingredient ids must be on VANILLA_ITEMS (no silent swap)',
    jsonSchema: 'enum on every ingredient id would hide the honesty path',
    enforcement: 'parseProjectSpec + noteOffAllowlistIngredients + prompt'
  },
  {
    rule: 'durability > 0 requires maxCount === 1',
    jsonSchema: 'cross-field item constraint',
    enforcement: 'parseProjectSpec + prompt'
  }
] as const

export function schemaPath(root: unknown, path: string[]): unknown {
  let current: unknown = root
  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

export function summarizeJsonSchema(schema: Record<string, unknown>): {
  type: unknown
  required: unknown
  propertyKeys: string[]
  itemsAttributesRequired: unknown
  itemsAttributesEnum: unknown
  recipesRequired: unknown
  recipesPattern: unknown
  commandsRequired: unknown
  unsupportedRequired: unknown
} {
  const properties = (schema.properties ?? {}) as Record<string, unknown>
  const attributes = schemaPath(schema, [
    'properties',
    'items',
    'items',
    'properties',
    'attributes',
    'items'
  ]) as Record<string, unknown> | undefined
  const recipes = schemaPath(schema, ['properties', 'recipes', 'items']) as Record<string, unknown> | undefined
  const commands = schemaPath(schema, ['properties', 'commands', 'items']) as Record<string, unknown> | undefined
  const unsupported = schemaPath(schema, ['properties', 'unsupportedRequests', 'items']) as
    | Record<string, unknown>
    | undefined
  return {
    type: schema.type,
    required: schema.required,
    propertyKeys: Object.keys(properties),
    itemsAttributesRequired: attributes?.required,
    itemsAttributesEnum: schemaPath(attributes ?? {}, ['properties', 'id', 'enum']),
    recipesRequired: recipes?.required,
    recipesPattern: schemaPath(recipes ?? {}, ['properties', 'pattern', 'items', 'pattern']),
    commandsRequired: commands?.required,
    unsupportedRequired: unsupported?.required
  }
}
