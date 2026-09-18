import type { ProjectSpec } from './spec'
import { hasWeaponBehavior } from './weaponSpec'

export const SPEC_EXPORT_FILENAME = 'specification.json'

export type GeneratorSupportStatus = 'IMPLEMENTED' | 'DESCRIPTION/UNSUPPORTED ONLY'

export interface GeneratorSupportRow {
  feature: string
  status: GeneratorSupportStatus
  note: string
}

/** Honest Forge 1.21.1 generator capabilities. Implemented means generated Java/assets, not compile/runtime proof. */
export const LEGENDARY_MACE_GENERATOR_SUPPORT: GeneratorSupportRow[] = [
  {
    feature: 'Mace smash mechanics',
    status: 'IMPLEMENTED',
    note: 'Forge 1.21.1 emits CraftStudioMaceItem extends MaceItem. Vanilla smash runs through MaceItem.hurtEnemy. Status is generated until Gradle compile / in-game smash is verified.'
  },
  {
    feature: 'Enchantments',
    status: 'IMPLEMENTED',
    note: 'Compatible enchantments from the spec are written onto the crafted item (recipe components + ItemCraftedEvent). Incompatible ids are recorded, not remapped. Custom enchantment types are not registered.'
  },
  {
    feature: 'Life Steal',
    status: 'IMPLEMENTED',
    note: 'Server LivingDamageEvent heals 20% of actual health damage, cap 4, max-health aware, hostile-only. Shockwave hits do not steal. Generated, not runtime-verified.'
  },
  {
    feature: 'Shockwaves',
    status: 'IMPLEMENTED',
    note: 'Smash-triggered server shockwave after the configured fall distance, per-wielder cooldown, radius/damage/impulse, particles, sound, cooldown feedback. Recursive activation is blocked.'
  },
  {
    feature: 'Terrain destruction',
    status: 'IMPLEMENTED',
    note: 'Bounded surface edits (radius, one block per column, max 24, allowlisted blocks, no fluids/block entities/drops). enableTerrainDestruction can disable edits while keeping the shockwave.'
  },
  {
    feature: 'Custom texture generation',
    status: 'IMPLEMENTED',
    note: 'Procedural 32×32 RGBA PNG (netherite_mace / generic_weapon) plus handheld item-model references. Existing hand-painted/imported PNGs are never overwritten. Ollama still does not draw images.'
  }
]

export const HAND_PAINTED_TEXTURE_PIPELINE: GeneratorSupportRow = {
  feature: 'Hand-painted / imported PNG attach-on-apply',
  status: 'IMPLEMENTED',
  note: 'If craftstudio/textures/<id>.png exists, Apply writes it into assets/.../textures/item|block. Procedural textures fill only missing item PNGs.'
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
  return 'Generator support: remaining unsupportedRequests are real gaps. Forge 1.21.1 weapon smash, Life Steal, shockwave, terrain, compatible enchantments, and procedural item textures are generated when present on items[].weapon. Compile and Minecraft runtime are separate statuses.'
}

export function specHasGeneratedWeapons(spec: ProjectSpec): boolean {
  return spec.items.some((item) => hasWeaponBehavior(item.weapon))
}
