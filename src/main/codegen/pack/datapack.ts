import { AppError } from '../../../shared/errors'
import { craftstudioPackPng } from '../../../shared/packIcon'
import { dataPackFormatFor } from '../../../shared/platformPins'
import type { ProjectSpec } from '../../../shared/spec'
import { isTrustedOutputPath } from '../allowlist'
import { planBlockAssetFiles } from '../blocks/registration'
import { planEntityLootFiles, planItemLootFiles } from '../loot/tables'
import type { PlannedFile } from '../types'
import { planOreFeatureJson } from '../worldgen/oreVeins'

function assertTrusted(relativePath: string): void {
  if (
    relativePath === 'pack.mcmeta' ||
    relativePath === 'pack.png' ||
    relativePath === 'DATAPACK.md' ||
    relativePath.startsWith('data/')
  ) {
    return
  }
  if (!isTrustedOutputPath(relativePath)) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `Refusing datapack path "${relativePath}".`,
      action: 'Datapack export only includes loot JSON, worldgen JSON, pack.mcmeta, and DATAPACK.md.'
    })
  }
}

function remapDataPath(relativePath: string): string | null {
  const prefix = 'src/main/resources/'
  if (!relativePath.startsWith(prefix)) {
    return null
  }
  return relativePath.slice(prefix.length)
}

export function planStandaloneDatapack(spec: ProjectSpec, minecraftVersion: string): PlannedFile[] {
  const loot = [...planEntityLootFiles(spec), ...planItemLootFiles(spec)]
  const blockLoot = planBlockAssetFiles(spec).filter((file) => file.relativePath.includes('/loot_table/'))
  const worldgen = planOreFeatureJson(spec)
  const jsonFiles = [...loot, ...blockLoot, ...worldgen]
    .map((file) => {
      const remapped = remapDataPath(file.relativePath)
      if (!remapped) {
        return null
      }
      return { ...file, relativePath: remapped }
    })
    .filter((file): file is PlannedFile => file !== null)

  if (jsonFiles.length === 0) {
    throw new AppError({
      code: 'EXPORT_FAILED',
      message: 'This spec has no loot tables or worldgen JSON to put in a datapack.',
      action: 'Add a block, item bonus chest table, mob drop, ore vein, surface patch, or spring, then export again.'
    })
  }

  const files: PlannedFile[] = [
    {
      relativePath: 'pack.mcmeta',
      encoding: 'utf8',
      contents: `${JSON.stringify(
        {
          pack: {
            pack_format: dataPackFormatFor(minecraftVersion),
            description: `${spec.displayName} loot + worldgen (CraftStudio datapack, no Java)`
          }
        },
        null,
        2
      )}\n`
    },
    {
      relativePath: 'pack.png',
      encoding: 'binary',
      contents: craftstudioPackPng()
    },
    {
      relativePath: 'DATAPACK.md',
      encoding: 'utf8',
      contents: [
        '# Standalone datapack (limits)',
        '',
        'This ZIP is loot + configured/placed feature JSON only. It is **not** the Java mod.',
        '',
        '- Includes: block/entity/item loot JSON and worldgen configured_feature + placed_feature JSON.',
        '- Does **not** include Java, Gradle, Fabric BiomeModifications, Forge/NeoForge biome modifiers, or GLM chest inject.',
        '- Vanilla will not place the features until you add them to biome JSON yourself (or use the Java mod).',
        '- Chest bonus `loot_table/chests/<modid>_bonus.json` is a table you can reference; it is not injected into vanilla chests.',
        '- `CraftStudioConfig` (`enableWorldgen`, `enableChestLoot`, `spawnWeightScale`) does not apply here.',
        '- Plugins cannot use this as a substitute for custom blocks.',
        '',
        `pack_format ${dataPackFormatFor(minecraftVersion)} for Minecraft ${minecraftVersion}.`,
        ''
      ].join('\n')
    },
    ...jsonFiles
  ]
  for (const file of files) {
    assertTrusted(file.relativePath)
  }
  return files
}
