import { minecraftBiomeId } from '../../../shared/spawn'
import type { ProjectSpec } from '../../../shared/spec'
import type { PlannedFile } from '../types'

export function planBiomeModifierFiles(spec: ProjectSpec, flavor: 'forge' | 'neoforge'): PlannedFile[] {
  return spec.mobs
    .filter((mob) => mob.spawn.enabled && mob.spawn.biomes.length > 0)
    .map((mob) => {
      const folder = flavor === 'neoforge' ? 'neoforge' : 'forge'
      const type = flavor === 'neoforge' ? 'neoforge:add_spawns' : 'forge:add_spawns'
      return {
        relativePath: `src/main/resources/data/${spec.modId}/${folder}/biome_modifier/${mob.id}_spawns.json`,
        encoding: 'utf8' as const,
        contents: `${JSON.stringify(
          {
            type,
            biomes: mob.spawn.biomes.map(minecraftBiomeId),
            spawners: {
              type: `${spec.modId}:${mob.id}`,
              weight: Math.max(1, Math.round(mob.spawn.weight * spec.config.spawnWeightScale)),
              minCount: mob.spawn.minGroup,
              maxCount: mob.spawn.maxGroup
            }
          },
          null,
          2
        )}\n`
      }
    })
}

export function planPluginSpawnGap(spec: ProjectSpec): PlannedFile[] {
  if (!spec.mobs.some((mob) => mob.spawn.enabled)) {
    return []
  }
  return [
    {
      relativePath: 'SPAWNS.md',
      encoding: 'utf8',
      contents: [
        '# Biome spawn tables',
        '',
        'Paper and Spigot cannot register biome spawn tables for custom entity types.',
        'CraftStudio plugin mobs are vanilla disguises. Use `/summoncustom <id>`.',
        'This is an honest capability gap, not a worldgen stack.',
        ''
      ].join('\n')
    }
  ]
}
