import { AppError } from '../../../shared/errors'
import { countOpaquePixels } from '../../../shared/pixelSpec'
import { customModelDataFor, packFormatFor, paperPinsFor } from '../../../shared/platformPins'
import { decodePng } from '../../../shared/png'
import type { ProjectSpec } from '../../../shared/spec'
import type { PlatformId, ProjectManifest } from '../../../shared/types'
import { isTrustedOutputPath } from '../allowlist'
import type { PlannedFile } from '../types'

export interface TextureMap {
  [itemId: string]: Buffer
}

function assertTrusted(relativePath: string): void {
  if (!isTrustedOutputPath(relativePath) && relativePath !== 'pack.mcmeta') {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `Refusing resource-pack path "${relativePath}".`,
      action: 'Assets must stay on the allowlisted pack / project prefixes.'
    })
  }
}

function itemModelJson(namespace: string, itemId: string): string {
  return `${JSON.stringify(
    {
      parent: 'minecraft:item/generated',
      textures: {
        layer0: `${namespace}:item/${itemId}`
      }
    },
    null,
    2
  )}\n`
}

function packMcmeta(minecraftVersion: string, description: string): string {
  return `${JSON.stringify(
    {
      pack: {
        pack_format: packFormatFor(minecraftVersion),
        description
      }
    },
    null,
    2
  )}\n`
}

function paperPredicateOverrides(spec: ProjectSpec): unknown {
  return {
    parent: 'minecraft:item/generated',
    textures: {
      layer0: 'minecraft:item/paper'
    },
    overrides: spec.items.map((item, index) => ({
      predicate: { custom_model_data: customModelDataFor(index) },
      model: `${spec.modId}:item/${item.id}`
    }))
  }
}

function paperRangeDispatch(spec: ProjectSpec): unknown {
  return {
    model: {
      type: 'minecraft:range_dispatch',
      property: 'minecraft:custom_model_data',
      index: 0,
      fallback: {
        type: 'minecraft:model',
        model: 'minecraft:item/paper'
      },
      entries: spec.items.map((item, index) => ({
        threshold: customModelDataFor(index),
        model: {
          type: 'minecraft:model',
          model: `${spec.modId}:item/${item.id}`
        }
      }))
    }
  }
}

export function assertTexturesPresent(spec: ProjectSpec, textures: TextureMap): void {
  const missing = spec.items.filter((item) => !textures[item.id]).map((item) => item.id)
  if (missing.length > 0) {
    throw new AppError({
      code: 'EXPORT_FAILED',
      message: `No painted or imported texture for: ${missing.join(', ')}.`,
      action: 'Open Assets, paint or import a PNG for each item, then export the resource pack.'
    })
  }
  for (const item of spec.items) {
    const png = textures[item.id]!
    const decoded = decodePng(png)
    if (countOpaquePixels(decoded.pixels) === 0) {
      throw new AppError({
        code: 'EXPORT_FAILED',
        message: `Texture for "${item.id}" is fully transparent.`,
        action: 'Paint or import real pixels. CraftStudio does not invent an AI-drawn texture.'
      })
    }
  }
}

export function planStandaloneResourcePack(
  manifest: ProjectManifest,
  spec: ProjectSpec,
  textures: TextureMap
): PlannedFile[] {
  if (manifest.platform !== 'fabric' && manifest.platform !== 'paper' && manifest.platform !== 'neoforge') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `Resource-pack export is not implemented for ${manifest.platform}.`,
      action: 'Export a pack for Fabric, NeoForge, or Paper. Forge and Spigot stay stubs.'
    })
  }
  assertTexturesPresent(spec, textures)
  const files: PlannedFile[] = []
  const packRoot = (relativePath: string, contents: string | Buffer, encoding: 'utf8' | 'binary'): void => {
    const path = relativePath === 'pack.mcmeta' ? 'pack.mcmeta' : relativePath
    assertTrusted(path.startsWith('assets/') || path === 'pack.mcmeta' ? `resource-pack/${path}` : path)
    files.push({
      relativePath: path,
      encoding,
      contents
    })
  }

  packRoot(
    'pack.mcmeta',
    packMcmeta(
      manifest.minecraftVersion,
      `${spec.displayName} (${manifest.platform} ${manifest.minecraftVersion})`
    ),
    'utf8'
  )

  if (manifest.platform === 'paper') {
    const pins = paperPinsFor(manifest.minecraftVersion)
    if (pins.itemModel === 'predicate') {
      packRoot(
        'assets/minecraft/models/item/paper.json',
        `${JSON.stringify(paperPredicateOverrides(spec), null, 2)}\n`,
        'utf8'
      )
    } else {
      packRoot(
        'assets/minecraft/items/paper.json',
        `${JSON.stringify(paperRangeDispatch(spec), null, 2)}\n`,
        'utf8'
      )
    }
  }

  for (const item of spec.items) {
    packRoot(`assets/${spec.modId}/models/item/${item.id}.json`, itemModelJson(spec.modId, item.id), 'utf8')
    packRoot(`assets/${spec.modId}/textures/item/${item.id}.png`, textures[item.id]!, 'binary')
  }

  return files
}

export function planProjectResourcePackFiles(
  manifest: ProjectManifest,
  spec: ProjectSpec,
  textures: TextureMap
): PlannedFile[] {
  return planStandaloneResourcePack(manifest, spec, textures).map((file) => ({
    ...file,
    relativePath: file.relativePath === 'pack.mcmeta' ? 'resource-pack/pack.mcmeta' : `resource-pack/${file.relativePath}`
  }))
}

export function attachGeneratedTextures(
  files: PlannedFile[],
  manifest: ProjectManifest,
  spec: ProjectSpec,
  textures: TextureMap
): PlannedFile[] {
  const next = [...files]
  const replaceModel = (itemId: string): void => {
    const relativePath = `src/main/resources/assets/${spec.modId}/models/item/${itemId}.json`
    const index = next.findIndex((file) => file.relativePath === relativePath)
    const model: PlannedFile = {
      relativePath,
      encoding: 'utf8',
      contents: itemModelJson(spec.modId, itemId)
    }
    if (index >= 0) {
      next[index] = model
    } else {
      next.push(model)
    }
    next.push({
      relativePath: `src/main/resources/assets/${spec.modId}/textures/item/${itemId}.png`,
      encoding: 'binary',
      contents: textures[itemId]!
    })
  }

  if (manifest.platform === 'fabric' || manifest.platform === 'neoforge') {
    for (const item of spec.items) {
      if (textures[item.id]) {
        replaceModel(item.id)
      }
    }
  }

  if (manifest.platform === 'paper' && spec.items.some((item) => textures[item.id])) {
    const present: TextureMap = {}
    for (const item of spec.items) {
      if (textures[item.id]) {
        present[item.id] = textures[item.id]!
      }
    }
    if (Object.keys(present).length === spec.items.length) {
      next.push(...planProjectResourcePackFiles(manifest, spec, present))
    }
  }

  return next
}

export function resourcePackClientNote(platform: PlatformId): string {
  if (platform === 'paper') {
    return 'Paper custom items stay vanilla paper + CustomModelData. Every player must install this resource pack on their client. The plugin jar does not add a new item id.'
  }
  if (platform === 'fabric' || platform === 'neoforge') {
    return 'This pack mirrors the mod item textures/models. The mod jar already includes the same assets; the standalone pack is for sharing or overlaying.'
  }
  return 'Resource-pack export is not implemented for this platform.'
}
