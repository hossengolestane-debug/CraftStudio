import { z } from 'zod'
import { AppError } from './errors'

export const PIXEL_SPEC_SCHEMA_VERSION = 1
export const TEXTURE_SIZES = [16, 32] as const
export type TextureSize = (typeof TEXTURE_SIZES)[number]

const hexColor = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Color must be #RRGGBB or #RRGGBBAA')

export const pixelSpecSchema = z.object({
  schemaVersion: z.literal(PIXEL_SPEC_SCHEMA_VERSION),
  width: z.union([z.literal(16), z.literal(32)]),
  height: z.union([z.literal(16), z.literal(32)]),
  palette: z.array(hexColor).min(1).max(64),
  pixels: z.array(z.array(z.number().int().min(-1).max(63)))
})

export type PixelSpec = z.infer<typeof pixelSpecSchema>

export const DEFAULT_PALETTE = [
  '#000000',
  '#ffffff',
  '#7f7f7f',
  '#c6c6c6',
  '#8b4513',
  '#228b22',
  '#4169e1',
  '#dc143c',
  '#ffd700',
  '#00ced1',
  '#9932cc',
  '#ff8c00',
  '#00000000'
] as const

export const paletteSuggestionSchema = z.object({
  palette: z.array(hexColor).min(2).max(16)
})

export function parsePixelSpec(input: unknown): PixelSpec {
  const parsed = pixelSpecSchema.safeParse(input)
  if (!parsed.success) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: 'Pixel specification is not valid.',
      action: 'Ollama may only emit palette / pixel-spec JSON. Raster PNGs come from the editor, not from model prose.',
      details: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
    })
  }
  const spec = parsed.data
  if (spec.pixels.length !== spec.height || spec.pixels.some((row) => row.length !== spec.width)) {
    throw new AppError({
      code: 'SPEC_INVALID',
      message: `Pixel grid must be ${spec.width}×${spec.height}.`,
      action: 'Fix the pixel-spec JSON or paint in the editor.'
    })
  }
  for (const row of spec.pixels) {
    for (const index of row) {
      if (index >= spec.palette.length) {
        throw new AppError({
          code: 'SPEC_INVALID',
          message: 'Pixel index is outside the palette.',
          action: 'Use -1 for transparent or a palette index.'
        })
      }
    }
  }
  return spec
}

export function parseHexColor(value: string): [number, number, number, number] {
  const hex = value.replace('#', '')
  const body = hex.length === 6 ? `${hex}ff` : hex
  return [
    Number.parseInt(body.slice(0, 2), 16),
    Number.parseInt(body.slice(2, 4), 16),
    Number.parseInt(body.slice(4, 6), 16),
    Number.parseInt(body.slice(6, 8), 16)
  ]
}

export function rasterizePixelSpec(spec: PixelSpec): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(spec.width * spec.height * 4)
  for (let y = 0; y < spec.height; y++) {
    for (let x = 0; x < spec.width; x++) {
      const index = spec.pixels[y]![x]!
      const offset = (y * spec.width + x) * 4
      if (index < 0) {
        pixels[offset] = 0
        pixels[offset + 1] = 0
        pixels[offset + 2] = 0
        pixels[offset + 3] = 0
        continue
      }
      const [r, g, b, a] = parseHexColor(spec.palette[index]!)
      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = a
    }
  }
  return pixels
}

export function pixelsToPixelSpec(width: TextureSize, height: TextureSize, pixels: Uint8ClampedArray): PixelSpec {
  const palette: string[] = []
  const grid: number[][] = []
  const indexOf = new Map<string, number>()
  for (let y = 0; y < height; y++) {
    const row: number[] = []
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      const r = pixels[offset]!
      const g = pixels[offset + 1]!
      const b = pixels[offset + 2]!
      const a = pixels[offset + 3]!
      if (a === 0) {
        row.push(-1)
        continue
      }
      const key = `#${[r, g, b, a].map((n) => n.toString(16).padStart(2, '0')).join('')}`
      let index = indexOf.get(key)
      if (index === undefined) {
        if (palette.length >= 64) {
          index = 0
        } else {
          index = palette.length
          palette.push(key)
          indexOf.set(key, index)
        }
      }
      row.push(index)
    }
    grid.push(row)
  }
  if (palette.length === 0) {
    palette.push('#00000000')
  }
  return {
    schemaVersion: PIXEL_SPEC_SCHEMA_VERSION,
    width,
    height,
    palette,
    pixels: grid
  }
}

export function countOpaquePixels(pixels: Uint8ClampedArray): number {
  let count = 0
  for (let i = 3; i < pixels.length; i += 4) {
    if ((pixels[i] ?? 0) > 0) {
      count += 1
    }
  }
  return count
}
