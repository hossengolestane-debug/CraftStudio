import { encodePngRgba } from './png'

/** 64×64 pack.png — a flat CraftStudio mark, not an AI-drawn texture. */
export function craftstudioPackPng(): Buffer {
  const size = 64
  const pixels = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const border = x < 3 || y < 3 || x >= size - 3 || y >= size - 3
      const bar = x >= 18 && x <= 26 && y >= 14 && y <= 50
      const arm = x >= 18 && x <= 44 && y >= 14 && y <= 22
      if (border) {
        pixels[i] = 20
        pixels[i + 1] = 20
        pixels[i + 2] = 20
        pixels[i + 3] = 255
      } else if (bar || arm) {
        pixels[i] = 232
        pixels[i + 1] = 168
        pixels[i + 2] = 56
        pixels[i + 3] = 255
      } else {
        pixels[i] = 36
        pixels[i + 1] = 48
        pixels[i + 2] = 44
        pixels[i + 3] = 255
      }
    }
  }
  return encodePngRgba(size, size, pixels)
}
