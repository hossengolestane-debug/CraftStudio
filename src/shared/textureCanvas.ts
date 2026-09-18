export type TextureTool = 'pencil' | 'eraser' | 'fill'

export class PixelHistory {
  private readonly past: Uint8ClampedArray[] = []
  private readonly future: Uint8ClampedArray[] = []

  constructor(private readonly max = 64) {}

  push(pixels: Uint8ClampedArray): void {
    this.past.push(new Uint8ClampedArray(pixels))
    if (this.past.length > this.max) {
      this.past.shift()
    }
    this.future.length = 0
  }

  undo(current: Uint8ClampedArray): Uint8ClampedArray | null {
    const prev = this.past.pop()
    if (!prev) {
      return null
    }
    this.future.push(new Uint8ClampedArray(current))
    return prev
  }

  redo(current: Uint8ClampedArray): Uint8ClampedArray | null {
    const next = this.future.pop()
    if (!next) {
      return null
    }
    this.past.push(new Uint8ClampedArray(current))
    return next
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }
}

export function clonePixels(pixels: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels)
}

export function setPixel(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  color: [number, number, number, number]
): void {
  if (x < 0 || y < 0 || x >= width) {
    return
  }
  const offset = (y * width + x) * 4
  if (offset + 3 >= pixels.length) {
    return
  }
  pixels[offset] = color[0]
  pixels[offset + 1] = color[1]
  pixels[offset + 2] = color[2]
  pixels[offset + 3] = color[3]
}

export function getPixel(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number
): [number, number, number, number] {
  const offset = (y * width + x) * 4
  return [pixels[offset] ?? 0, pixels[offset + 1] ?? 0, pixels[offset + 2] ?? 0, pixels[offset + 3] ?? 0]
}

function sameColor(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

export function floodFill(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  color: [number, number, number, number]
): void {
  const target = getPixel(pixels, width, x, y)
  if (sameColor(target, color)) {
    return
  }
  const stack: Array<[number, number]> = [[x, y]]
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) {
      continue
    }
    if (!sameColor(getPixel(pixels, width, cx, cy), target)) {
      continue
    }
    setPixel(pixels, width, cx, cy, color)
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
  }
}

export function blankTexture(width: number, height: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4)
}

export function applyTool(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  tool: TextureTool,
  x: number,
  y: number,
  color: [number, number, number, number]
): void {
  if (tool === 'fill') {
    floodFill(pixels, width, height, x, y, color)
    return
  }
  if (tool === 'eraser') {
    setPixel(pixels, width, x, y, [0, 0, 0, 0])
    return
  }
  setPixel(pixels, width, x, y, color)
}

export function hashDefaultTexture(width: number, height: number, seed: string): Uint8ClampedArray {
  const pixels = blankTexture(width, height)
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  const r = (hash >> 16) & 0xff
  const g = (hash >> 8) & 0xff
  const b = hash & 0xff
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const checker = ((x >> 1) + (y >> 1)) % 2 === 0
      if (border) {
        setPixel(pixels, width, x, y, [32, 32, 32, 255])
      } else if (checker) {
        setPixel(pixels, width, x, y, [r, g, b, 255])
      } else {
        setPixel(pixels, width, x, y, [Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 40), 255])
      }
    }
  }
  return pixels
}

export function nearestResize(
  source: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number
): Uint8ClampedArray {
  const dest = blankTexture(destW, destH)
  for (let y = 0; y < destH; y++) {
    for (let x = 0; x < destW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / destW))
      const sy = Math.min(srcH - 1, Math.floor((y * srcH) / destH))
      dest.set(source.subarray((sy * srcW + sx) * 4, (sy * srcW + sx) * 4 + 4), (y * destW + x) * 4)
    }
  }
  return dest
}
