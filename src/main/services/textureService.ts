import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../../shared/errors'
import { parsePixelSpec, type PixelSpec } from '../../shared/pixelSpec'
import { decodePng, encodePngRgba } from '../../shared/png'
import { isTrustedOutputPath } from '../codegen/allowlist'
import { resolveProjectFile } from './pathSafety'

export const TEXTURE_DIR = 'craftstudio/textures'

export function texturePngPath(itemId: string): string {
  return `${TEXTURE_DIR}/${itemId}.png`
}

export function texturePixelSpecPath(itemId: string): string {
  return `${TEXTURE_DIR}/${itemId}.pixels.json`
}

function assertItemId(itemId: string): void {
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(itemId)) {
    throw new AppError({
      code: 'VALIDATION',
      message: `Invalid item id "${itemId}".`,
      action: 'Use a spec item id (lowercase [a-z0-9_]).'
    })
  }
}

export interface TextureRecord {
  itemId: string
  relativePath: string
  width: number
  height: number
  pixels: number[]
}

export async function saveItemTexture(
  projectsRoot: string,
  projectDirName: string,
  itemId: string,
  width: number,
  height: number,
  pixels: Uint8Array
): Promise<TextureRecord> {
  assertItemId(itemId)
  if ((width !== 16 && width !== 32) || width !== height) {
    throw new AppError({
      code: 'VALIDATION',
      message: 'Textures must be 16×16 or 32×32.',
      action: 'Use a size preset in the texture editor.'
    })
  }
  const relativePath = texturePngPath(itemId)
  if (!isTrustedOutputPath(relativePath)) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `Refusing texture path "${relativePath}".`,
      action: 'Textures must stay under craftstudio/textures/.'
    })
  }
  const png = encodePngRgba(width, height, pixels)
  const target = resolveProjectFile(projectsRoot, projectDirName, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, png)
  return { itemId, relativePath, width, height, pixels: Array.from(pixels) }
}

export async function savePixelSpec(
  projectsRoot: string,
  projectDirName: string,
  itemId: string,
  spec: unknown
): Promise<PixelSpec> {
  assertItemId(itemId)
  const parsed = parsePixelSpec(spec)
  const relativePath = texturePixelSpecPath(itemId)
  if (!isTrustedOutputPath(relativePath)) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `Refusing pixel-spec path "${relativePath}".`,
      action: 'Pixel specs must stay under craftstudio/textures/.'
    })
  }
  const target = resolveProjectFile(projectsRoot, projectDirName, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
  return parsed
}

export async function loadItemTexture(
  projectsRoot: string,
  projectDirName: string,
  itemId: string
): Promise<TextureRecord | null> {
  assertItemId(itemId)
  const relativePath = texturePngPath(itemId)
  const target = resolveProjectFile(projectsRoot, projectDirName, relativePath)
  try {
    const png = await readFile(target)
    const decoded = decodePng(png)
    return {
      itemId,
      relativePath,
      width: decoded.width,
      height: decoded.height,
      pixels: Array.from(decoded.pixels)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function loadProjectTextures(
  projectsRoot: string,
  projectDirName: string,
  itemIds: string[]
): Promise<Record<string, Buffer>> {
  const textures: Record<string, Buffer> = {}
  for (const itemId of itemIds) {
    assertItemId(itemId)
    const relativePath = texturePngPath(itemId)
    if (!isTrustedOutputPath(relativePath)) {
      continue
    }
    try {
      textures[itemId] = await readFile(resolveProjectFile(projectsRoot, projectDirName, relativePath))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
  return textures
}
