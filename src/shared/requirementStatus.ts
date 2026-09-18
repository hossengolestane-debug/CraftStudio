export type RequirementStatus = 'unsupported' | 'generated' | 'compiled' | 'runtime-verified'

export interface RequirementRow {
  id: string
  requirement: string
  status: RequirementStatus
  evidence: string
}

export function requirementMarkdown(rows: RequirementRow[]): string {
  return [
    '# Requirement status',
    '',
    'Statuses: `unsupported` | `generated` | `compiled` | `runtime-verified`.',
    'Generated means template/Java/JSON was emitted. It is not a compile or in-game proof.',
    '',
    '| Requirement | Status | Evidence |',
    '| --- | --- | --- |',
    ...rows.map((row) => `| ${row.requirement} | ${row.status} | ${row.evidence.replace(/\|/g, '/')} |`),
    ''
  ].join('\n')
}

export function forgeWeaponRequirementRows(input: {
  platform: string
  minecraftVersion: string
  hasSmash: boolean
  hasLifeSteal: boolean
  hasShockwave: boolean
  hasTerrain: boolean
  hasEnchantments: boolean
  hasTexture: boolean
  recipeExact: boolean
  unsolicitedMob: boolean
  unsolicitedLoot: boolean
  promptPreserved: boolean
}): RequirementRow[] {
  const forge = input.platform === 'forge' && input.minecraftVersion === '1.21.1'
  const gen = (ok: boolean): RequirementRow['status'] =>
    !forge ? 'unsupported' : ok ? 'generated' : 'unsupported'
  return [
    {
      id: 'request-preservation',
      requirement: 'Full original request stored',
      status: input.promptPreserved ? 'generated' : 'unsupported',
      evidence: input.promptPreserved
        ? 'spec.prompt holds the original request without mid-word truncation.'
        : 'Prompt was truncated or replaced.'
    },
    {
      id: 'recipe',
      requirement: 'Exact shaped recipe',
      status: input.recipeExact ? 'generated' : 'unsupported',
      evidence: input.recipeExact
        ? 'Recipe JSON uses the requested pattern and keys. Rejected ids are not swapped.'
        : 'No exact recipe was emitted.'
    },
    {
      id: 'no-unsolicited-mob',
      requirement: 'No unsolicited custom mob',
      status: input.unsolicitedMob ? 'unsupported' : 'generated',
      evidence: input.unsolicitedMob
        ? 'A mob entry was added without an explicit create-mob request.'
        : '"Affects hostile mobs" is treated as a combat filter, not a mob to spawn.'
    },
    {
      id: 'no-unsolicited-loot',
      requirement: 'Chest loot disabled unless requested',
      status: input.unsolicitedLoot ? 'unsupported' : 'generated',
      evidence: input.unsolicitedLoot
        ? 'Chest loot files or enableChestLoot=true without an explicit request.'
        : 'Optional chest inject stays off unless the prompt asked for it.'
    },
    {
      id: 'mace-smash',
      requirement: 'Mace smash behavior',
      status: gen(input.hasSmash),
      evidence: forge
        ? input.hasSmash
          ? 'Forge emitter writes a MaceItem subclass. Compile/runtime not implied.'
          : 'Smash was not requested on the spec.'
        : 'Smash Java is generated for Forge 1.21.1 only.'
    },
    {
      id: 'enchantments',
      requirement: 'Compatible enchantments on crafted item',
      status: gen(input.hasEnchantments),
      evidence: input.hasEnchantments
        ? 'Recipe components + ItemCraftedEvent apply listed compatible enchantments.'
        : 'No compatible enchantments were selected.'
    },
    {
      id: 'life-steal',
      requirement: 'Direct-hit Life Steal',
      status: gen(input.hasLifeSteal),
      evidence: input.hasLifeSteal
        ? 'Server LivingDamageEvent heals 20% of actual damage, cap 4, hostile-only, no shockwave steal.'
        : 'Life Steal was not requested.'
    },
    {
      id: 'shockwave',
      requirement: 'Smash-triggered shockwave',
      status: gen(input.hasShockwave),
      evidence: input.hasShockwave
        ? 'Server shockwave after fall >= min, per-wielder cooldown, radius/damage/impulse from spec.'
        : 'Shockwave was not requested.'
    },
    {
      id: 'terrain',
      requirement: 'Bounded terrain effects',
      status: gen(input.hasTerrain),
      evidence: input.hasTerrain
        ? 'Allowlisted surface blocks only; config enableTerrainDestruction can disable without dropping shockwave.'
        : 'Terrain was not requested.'
    },
    {
      id: 'texture',
      requirement: 'Real item texture + model',
      status: input.hasTexture ? 'generated' : 'unsupported',
      evidence: input.hasTexture
        ? 'A 32×32 RGBA PNG and handheld item model were packaged. Filename-only claims are not used.'
        : 'No texture pixels were packaged.'
    },
    {
      id: 'compile',
      requirement: 'Exported Gradle compile',
      status: 'unsupported',
      evidence: 'Not claimed here. See FORGE_WEAPON_WORKFLOW.md for compile status.'
    },
    {
      id: 'runtime',
      requirement: 'Minecraft client runtime',
      status: 'unsupported',
      evidence: 'Not claimed here. In-game smash/life steal/shockwave stay NOT RUN until a client session is recorded.'
    }
  ]
}
