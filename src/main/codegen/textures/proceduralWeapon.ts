import { encodePngRgba } from '../../../shared/png'
import type { SpecItem } from '../../../shared/spec'
import type { WeaponTextureStyle } from '../../../shared/weaponSpec'

function px(pixels: Uint8ClampedArray, width: number, x: number, y: number, r: number, g: number, b: number, a = 255): void {
  if (x < 0 || y < 0 || x >= width || y >= width) {
    return
  }
  const i = (y * width + x) * 4
  pixels[i] = r
  pixels[i + 1] = g
  pixels[i + 2] = b
  pixels[i + 3] = a
}

function blend(pixels: Uint8ClampedArray, width: number, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= width || y >= width) {
    return
  }
  const i = (y * width + x) * 4
  const srcA = a / 255
  const dstA = (pixels[i + 3] ?? 0) / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA <= 0) {
    return
  }
  pixels[i] = Math.round((r * srcA + (pixels[i] ?? 0) * dstA * (1 - srcA)) / outA)
  pixels[i + 1] = Math.round((g * srcA + (pixels[i + 1] ?? 0) * dstA * (1 - srcA)) / outA)
  pixels[i + 2] = Math.round((b * srcA + (pixels[i + 2] ?? 0) * dstA * (1 - srcA)) / outA)
  pixels[i + 3] = Math.round(outA * 255)
}

/** Original 32×32 item texture. Not an entity skin and not a filename-only claim. */
export function renderWeaponTexture(item: SpecItem): Buffer {
  const style = item.weapon?.textureStyle ?? 'none'
  if (style === 'generic_weapon') {
    return renderGenericWeapon()
  }
  return renderNetheriteMace()
}

export function textureStyleForItem(item: SpecItem): WeaponTextureStyle {
  return item.weapon?.textureStyle ?? 'none'
}

function renderNetheriteMace(): Buffer {
  const width = 32
  const pixels = new Uint8ClampedArray(width * width * 4)

  for (let y = 16; y < 32; y++) {
    for (let x = 14; x <= 17; x++) {
      const shade = 22 + ((x + y) % 3) * 6
      px(pixels, width, x, y, shade, shade - 4, shade - 6)
    }
    blend(pixels, width, 13, y, 18, 14, 12, 90)
    blend(pixels, width, 18, y, 18, 14, 12, 90)
  }
  for (let x = 13; x <= 18; x++) {
    px(pixels, width, x, 15, 42, 32, 18)
    px(pixels, width, x, 16, 198, 152, 42)
  }

  for (let y = 3; y <= 15; y++) {
    const span = y < 6 || y > 13 ? 6 : 8
    for (let x = 16 - span; x <= 16 + span; x++) {
      const edge = x === 16 - span || x === 16 + span || y === 3 || y === 15
      if (edge) {
        px(pixels, width, x, y, 212, 168, 36)
      } else {
        const metallic = 140 + ((x * 13 + y * 7) % 40)
        px(pixels, width, x, y, metallic, metallic + 4, metallic + 8)
      }
    }
  }

  for (let y = 6; y <= 11; y++) {
    for (let x = 13; x <= 19; x++) {
      const dx = x - 16
      const dy = y - 8
      if (dx * dx + dy * dy <= 8) {
        px(pixels, width, x, y, 236, 196, 48)
      }
      if (dx * dx + dy * dy <= 3) {
        px(pixels, width, x, y, 255, 220, 72)
      }
    }
  }

  const cracks: [number, number][] = [
    [12, 7],
    [11, 8],
    [10, 9],
    [20, 7],
    [21, 8],
    [19, 10],
    [16, 5],
    [15, 4],
    [17, 12],
    [14, 12],
    [18, 6],
    [13, 10]
  ]
  for (const [x, y] of cracks) {
    px(pixels, width, x, y, 126, 42, 176)
    blend(pixels, width, x + 1, y, 176, 96, 220, 160)
  }

  return encodePngRgba(width, width, pixels)
}

function renderGenericWeapon(): Buffer {
  const width = 32
  const pixels = new Uint8ClampedArray(width * width * 4)
  for (let i = 0; i < 18; i++) {
    const x = 22 - i
    const y = 6 + i
    px(pixels, width, x, y, 186, 190, 198)
    px(pixels, width, x + 1, y, 220, 222, 228)
    px(pixels, width, x - 1, y, 92, 96, 104)
  }
  for (let y = 22; y < 31; y++) {
    px(pixels, width, 7, y, 96, 62, 28)
    px(pixels, width, 8, y, 128, 86, 40)
  }
  px(pixels, width, 8, 22, 198, 152, 42)
  return encodePngRgba(width, width, pixels)
}
