import { minecraftBiomeId } from '../../../shared/spawn'
import type { ProjectSpec, SpecWorldgen } from '../../../shared/spec'
import { DEEPSLATE_ORE, worldgenBiomesOrAllowlist } from '../../../shared/worldgen'
import type { PlannedFile } from '../types'

function configuredFeatureJson(entry: SpecWorldgen): string {
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
            state: { Name: entry.block }
          },
          {
            target: {
              predicate_type: 'minecraft:tag_match',
              tag: 'minecraft:deepslate_ore_replaceables'
            },
            state: { Name: DEEPSLATE_ORE[entry.block] }
          }
        ]
      }
    },
    null,
    2
  )}\n`
}

function placedFeatureJson(modId: string, entry: SpecWorldgen): string {
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

export function planOreFeatureJson(spec: ProjectSpec): PlannedFile[] {
  return spec.worldgen.flatMap((entry) => [
    {
      relativePath: `src/main/resources/data/${spec.modId}/worldgen/configured_feature/${entry.id}.json`,
      encoding: 'utf8' as const,
      contents: configuredFeatureJson(entry)
    },
    {
      relativePath: `src/main/resources/data/${spec.modId}/worldgen/placed_feature/${entry.id}.json`,
      encoding: 'utf8' as const,
      contents: placedFeatureJson(spec.modId, entry)
    }
  ])
}

export function planOreBiomeModifiers(spec: ProjectSpec, flavor: 'forge' | 'neoforge'): PlannedFile[] {
  return spec.worldgen.map((entry) => {
    const folder = flavor === 'neoforge' ? 'neoforge' : 'forge'
    const type = flavor === 'neoforge' ? 'neoforge:add_features' : 'forge:add_features'
    const biomes = worldgenBiomesOrAllowlist(entry.biomes).map(minecraftBiomeId)
    return {
      relativePath: `src/main/resources/data/${spec.modId}/${folder}/biome_modifier/${entry.id}_ores.json`,
      encoding: 'utf8' as const,
      contents: `${JSON.stringify(
        {
          type,
          biomes,
          features: `${spec.modId}:${entry.id}`,
          step: 'underground_ores'
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
        `- ${entry.id}: ${entry.block} size=${entry.size} count=${entry.count} y=${entry.minY}..${entry.maxY} biomes=${
          worldgenBiomesOrAllowlist(entry.biomes).join(', ')
        }`
    )
    .join('\n')
  if (platform === 'plugin') {
    return [
      '# Worldgen (unsupported on plugins)',
      '',
      'Paper and Spigot cannot register configured/placed features or biome modifiers.',
      'CraftStudio will not emit fake ore JSON for plugins. Remove worldgen entries or use Fabric / Forge / NeoForge.',
      'This is not a dimension or structure stack.',
      ''
    ].join('\n')
  }
  return [
    '# Worldgen MVP (ore veins)',
    '',
    `${platform} emits vanilla-block ore configured_feature + placed_feature JSON only.`,
    'No custom blocks, dimensions, or structures. Deepslate counterparts are included for the stone ore tag pair.',
    platform === 'fabric'
      ? 'Fabric adds the placed feature with BiomeModifications.addFeature(UNDERGROUND_ORES).'
      : `${platform} adds the placed feature with an add_features biome modifier.`,
    rows || '- No ore veins in this spec.',
    ''
  ].join('\n')
}

export function planWorldgenDocs(spec: ProjectSpec, platform: 'fabric' | 'forge' | 'neoforge' | 'plugin'): PlannedFile[] {
  if (spec.worldgen.length === 0 && platform !== 'plugin') {
    return []
  }
  if (platform === 'plugin' && spec.worldgen.length === 0) {
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
