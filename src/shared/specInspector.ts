import type { ProjectSpec } from './spec'

export const SPEC_EXPORT_FILENAME = 'specification.json'

export type GeneratorSupportStatus = 'IMPLEMENTED' | 'DESCRIPTION/UNSUPPORTED ONLY'

export interface GeneratorSupportRow {
  feature: string
  status: GeneratorSupportStatus
  note: string
}

/** Honest Forge (and sibling mod) generator capabilities. Description text is not implementation. */
export const LEGENDARY_MACE_GENERATOR_SUPPORT: GeneratorSupportRow[] = [
  {
    feature: 'Mace smash mechanics',
    status: 'DESCRIPTION/UNSUPPORTED ONLY',
    note: 'Forge/Fabric emit a generic Item, not a mace type. No smash attack, Density, Breach, or wind-charge smash handler is generated.'
  },
  {
    feature: 'Enchantments',
    status: 'DESCRIPTION/UNSUPPORTED ONLY',
    note: 'No Enchantment registry or custom enchantment classes are emitted. Prompt text is recorded in unsupportedRequests.'
  },
  {
    feature: 'Life Steal',
    status: 'DESCRIPTION/UNSUPPORTED ONLY',
    note: 'No on-hit healing or LivingHurt handler is generated.'
  },
  {
    feature: 'Shockwaves',
    status: 'DESCRIPTION/UNSUPPORTED ONLY',
    note: 'No area-of-effect damage is generated.'
  },
  {
    feature: 'Terrain destruction',
    status: 'DESCRIPTION/UNSUPPORTED ONLY',
    note: 'No block-breaking-on-hit or terrain edit is generated.'
  },
  {
    feature: 'Custom texture generation',
    status: 'DESCRIPTION/UNSUPPORTED ONLY',
    note: 'Ollama does not draw PNGs. Users can paint or import a PNG on Assets; Apply copies that file into the jar. Unpainted items get no invented texture. Entity skins use a placeholder PNG. pack.png is a CraftStudio mark.'
  }
]

export const HAND_PAINTED_TEXTURE_PIPELINE: GeneratorSupportRow = {
  feature: 'Hand-painted / imported PNG attach-on-apply',
  status: 'IMPLEMENTED',
  note: 'If craftstudio/textures/<id>.png exists, Apply writes it into assets/.../textures/item|block. That is a real pixel pipeline, not AI generation.'
}

export function formatSpecJson(spec: ProjectSpec): string {
  return `${JSON.stringify(spec, null, 2)}\n`
}

export function specsMatch(left: ProjectSpec | null, right: ProjectSpec | null): boolean {
  if (!left || !right) {
    return false
  }
  return JSON.stringify(left) === JSON.stringify(right)
}

export function generatorSupportNote(unsupportedCount: number): string | null {
  if (unsupportedCount <= 0) {
    return null
  }
  return 'Generator support: schema-valid is not the same as implemented. Forge emits a generic custom item (optional attributes, durability, recipe, stub command) plus a painted PNG if you added one. Mace smash, enchantments, life steal, shockwaves, terrain edits, and AI textures are not generated.'
}
