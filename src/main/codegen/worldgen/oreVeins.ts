import { minecraftBiomeId } from '../../../shared/spawn'
import type { ProjectSpec, SpecWorldgen } from '../../../shared/spec'
import {
  deepslateCounterpart,
  resolveWorldgenBlockId,
  worldgenBiomesOrAllowlist
} from '../../../shared/worldgen'
import type { PlannedFile } from '../types'

function resolvedBlock(spec: ProjectSpec, entry: SpecWorldgen): string {
  return resolveWorldgenBlockId(
    spec.modId,
    entry.block,
    spec.blocks.map((block) => block.id)
  )
}

function oreConfiguredJson(spec: ProjectSpec, entry: SpecWorldgen): string {
  const placed = resolvedBlock(spec, entry)
  const deepslate = deepslateCounterpart(entry.block, placed)
  return `${JSON.stringify(
    {
      type: 'minecraft:ore',
      config: {
        size: entry.size,
        discard_chance_on_air_exposure: 0.0,
        targets: [
          {
            target: {
              predicate_type: 'minecraft:tag_match',
              tag: 'minecraft:stone_ore_replaceables'
            },
            state: { Name: placed }
          },
          {
            target: {
              predicate_type: 'minecraft:tag_match',
              tag: 'minecraft:deepslate_ore_replaceables'
            },
            state: { Name: deepslate }
          }
        ]
      }
    },
    null,
    2
  )}\n`
}

function patchConfiguredJson(spec: ProjectSpec, entry: SpecWorldgen): string {
  const placed = resolvedBlock(spec, entry)
  return `${JSON.stringify(
    {
      type: 'minecraft:random_patch',
      config: {
        tries: entry.count,
        xz_spread: Math.min(15, Math.max(1, entry.size)),
        y_spread: 3,
        feature: {
          feature: {
            type: 'minecraft:simple_block',
            config: {
              to_place: {
                type: 'minecraft:simple_state_provider',
                state: { Name: placed }
              }
            }
          },
          placement: [
            {
              type: 'minecraft:block_predicate_filter',
              predicate: {
                type: 'minecraft:matching_blocks',
                blocks: 'minecraft:air'
              }
            }
          ]
        }
      }
    },
    null,
    2
  )}\n`
}

function orePlacedJson(modId: string, entry: SpecWorldgen): string {
  return `${JSON.stringify(
    {
      feature: `${modId}:${entry.id}`,
      placement: [
        { type: 'minecraft:count', count: entry.count },
        { type: 'minecraft:in_square' },
        {
          type: 'minecraft:height_range',
          height: {
            type: 'minecraft:uniform',
            min_inclusive: { absolute: entry.minY },
            max_inclusive: { absolute: entry.maxY }
          }
        },
        { type: 'minecraft:biome' }
      ]
    },
    null,
    2
  )}\n`
}

function springConfiguredJson(entry: SpecWorldgen): string {
  const fluid = entry.block === 'minecraft:lava' ? 'minecraft:lava' : 'minecraft:water'
  return `${JSON.stringify(
    {
      type: 'minecraft:spring_feature',
      config: {
        state: { Name: fluid, Properties: { falling: 'true' } },
        rock_count: Math.min(8, Math.max(1, entry.size)),
        hole_count: 1,
        requires_block_below: true,
        valid_blocks: ['minecraft:stone', 'minecraft:granite', 'minecraft:diorite', 'minecraft:andesite']
      }
    },
    null,
    2
  )}\n`
}

function configuredJsonFor(spec: ProjectSpec, entry: SpecWorldgen): string {
  if (entry.kind === 'surface_patch') {
    return patchConfiguredJson(spec, entry)
  }
  if (entry.kind === 'spring') {
    return springConfiguredJson(entry)
  }
  return oreConfiguredJson(spec, entry)
}

function placedJsonFor(modId: string, entry: SpecWorldgen): string {
  return entry.kind === 'surface_patch' ? patchPlacedJson(modId, entry) : orePlacedJson(modId, entry)
}

function worldgenStep(entry: SpecWorldgen): { yarn: string; mojang: string; file: string } {
  if (entry.kind === 'surface_patch') {
    return { yarn: 'VEGETAL_DECORATION', mojang: 'vegetal_decoration', file: 'patch' }
  }
  if (entry.kind === 'spring') {
    return { yarn: 'FLUID_SPRINGS', mojang: 'fluid_springs', file: 'spring' }
  }
  return { yarn: 'UNDERGROUND_ORES', mojang: 'underground_ores', file: 'ores' }
}

function patchPlacedJson(modId: string, entry: SpecWorldgen): string {
  return `${JSON.stringify(
    {
      feature: `${modId}:${entry.id}`,
      placement: [
        { type: 'minecraft:rarity_filter', chance: Math.max(1, Math.min(32, 16 - Math.min(15, entry.size) + 4)) },
        { type: 'minecraft:in_square' },
        { type: 'minecraft:heightmap', heightmap: 'MOTION_BLOCKING' },
        { type: 'minecraft:biome' }
      ]
    },
    null,
    2
  )}\n`
}

export function planOreFeatureJson(spec: ProjectSpec): PlannedFile[] {
  return spec.worldgen.flatMap((entry) => [
    {
      relativePath: `src/main/resources/data/${spec.modId}/worldgen/configured_feature/${entry.id}.json`,
      encoding: 'utf8' as const,
      contents: configuredJsonFor(spec, entry)
    },
    {
      relativePath: `src/main/resources/data/${spec.modId}/worldgen/placed_feature/${entry.id}.json`,
      encoding: 'utf8' as const,
      contents: placedJsonFor(spec.modId, entry)
    }
  ])
}

export function planOreBiomeModifiers(spec: ProjectSpec, flavor: 'forge' | 'neoforge'): PlannedFile[] {
  if (!spec.config.enableWorldgen) {
    return []
  }
  return spec.worldgen.map((entry) => {
    const folder = flavor === 'neoforge' ? 'neoforge' : 'forge'
    const type = flavor === 'neoforge' ? 'neoforge:add_features' : 'forge:add_features'
    const biomes = worldgenBiomesOrAllowlist(entry.biomes).map(minecraftBiomeId)
    const step = worldgenStep(entry)
    return {
      relativePath: `src/main/resources/data/${spec.modId}/${folder}/biome_modifier/${entry.id}_${step.file}.json`,
      encoding: 'utf8' as const,
      contents: `${JSON.stringify(
        {
          type,
          biomes,
          features: `${spec.modId}:${entry.id}`,
          step: step.mojang
        },
        null,
        2
      )}\n`
    }
  })
}

export function worldgenDoc(spec: ProjectSpec, platform: 'fabric' | 'forge' | 'neoforge' | 'plugin'): string {
  const rows = spec.worldgen
    .map(
      (entry) =>
        `- ${entry.id} (${entry.kind}): ${entry.block} size=${entry.size} count=${entry.count} y=${entry.minY}..${entry.maxY} biomes=${
          worldgenBiomesOrAllowlist(entry.biomes).join(', ')
        }`
    )
    .join('\n')
  if (platform === 'plugin') {
    return [
      '# Worldgen (unsupported on plugins)',
      '',
      'Paper and Spigot cannot register configured/placed features or biome modifiers.',
      'CraftStudio will not emit fake ore or random_patch JSON for plugins. Remove worldgen entries or use Fabric / Forge / NeoForge.',
      'This is not a dimension or structure stack.',
      ''
    ].join('\n')
  }
  return [
    '# Worldgen (ore veins + surface patches + springs)',
    '',
    `${platform} emits configured_feature + placed_feature JSON.`,
    'ore_vein uses minecraft:ore and may place a spec block or an allowlisted vanilla ore (deepslate counterpart for vanilla ores only).',
    'surface_patch uses minecraft:random_patch + simple_block (structure-less vegetation).',
    'spring uses minecraft:spring_feature (water or lava) on stone-family rocks. No dimensions or jigsaw structures.',
    platform === 'fabric'
      ? 'Fabric adds placed features with BiomeModifications (UNDERGROUND_ORES, VEGETAL_DECORATION, or FLUID_SPRINGS).'
      : `${platform} adds placed features with an add_features biome modifier.`,
    rows || '- No worldgen entries in this spec.',
    ''
  ].join('\n')
}

export function planWorldgenDocs(spec: ProjectSpec, platform: 'fabric' | 'forge' | 'neoforge' | 'plugin'): PlannedFile[] {
  const pluginAsked = spec.unsupportedRequests.some((item) => item.feature === 'worldgen')
  if (spec.worldgen.length === 0 && platform !== 'plugin') {
    return []
  }
  if (platform === 'plugin' && spec.worldgen.length === 0 && !pluginAsked) {
    return []
  }
  return [
    {
      relativePath: 'WORLDGEN.md',
      encoding: 'utf8',
      contents: worldgenDoc(spec, platform)
    }
  ]
}
