import { describe, expect, it } from 'vitest'
import { parsePixelSpec, pixelsToPixelSpec, rasterizePixelSpec } from '../src/shared/pixelSpec'
import { decodePng, encodePngRgba } from '../src/shared/png'
import {
  applyTool,
  blankTexture,
  floodFill,
  PixelHistory,
  setPixel
} from '../src/shared/textureCanvas'

describe('texture editor undo and PNG round-trip', () => {
  it('undoes and redoes pixel edits', () => {
    const history = new PixelHistory()
    const first = blankTexture(16, 16)
    setPixel(first, 16, 0, 0, [255, 0, 0, 255])
    history.push(first)
    const second = blankTexture(16, 16)
    setPixel(second, 16, 1, 1, [0, 255, 0, 255])
    const undone = history.undo(second)
    expect(undone?.[0]).toBe(255)
    const redone = history.redo(undone!)
    const green = (1 * 16 + 1) * 4
    expect(redone?.[green]).toBe(0)
    expect(redone?.[green + 3]).toBe(255)
  })

  it('flood-fills a connected region', () => {
    const pixels = blankTexture(4, 4)
    floodFill(pixels, 4, 4, 0, 0, [10, 20, 30, 255])
    expect(pixels[0]).toBe(10)
    expect(pixels[4 * 4 * 4 - 1]).toBe(255)
  })

  it('applies pencil and eraser', () => {
    const pixels = blankTexture(16, 16)
    applyTool(pixels, 16, 16, 'pencil', 2, 2, [1, 2, 3, 255])
    expect(pixels[(2 * 16 + 2) * 4]).toBe(1)
    applyTool(pixels, 16, 16, 'eraser', 2, 2, [1, 2, 3, 255])
    expect(pixels[(2 * 16 + 2) * 4 + 3]).toBe(0)
  })

  it('round-trips RGBA PNG encode/decode', () => {
    const pixels = blankTexture(16, 16)
    setPixel(pixels, 16, 3, 4, [12, 34, 56, 200])
    const png = encodePngRgba(16, 16, pixels)
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    const decoded = decodePng(png)
    expect(decoded.width).toBe(16)
    expect(decoded.height).toBe(16)
    const offset = (4 * 16 + 3) * 4
    expect(decoded.pixels[offset]).toBe(12)
    expect(decoded.pixels[offset + 1]).toBe(34)
    expect(decoded.pixels[offset + 2]).toBe(56)
    expect(decoded.pixels[offset + 3]).toBe(200)
  })

  it('round-trips pixel-spec JSON through the rasterizer', () => {
    const spec = parsePixelSpec({
      schemaVersion: 1,
      width: 16,
      height: 16,
      palette: ['#ff0000', '#00000000'],
      pixels: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (__, x) => (x === y ? 0 : -1)))
    })
    const pixels = rasterizePixelSpec(spec)
    expect(pixels[0]).toBe(255)
    expect(pixels[3]).toBe(255)
    const back = pixelsToPixelSpec(16, 16, pixels)
    expect(back.pixels[0]![0]).toBe(0)
    expect(back.pixels[0]![1]).toBe(-1)
  })
})
