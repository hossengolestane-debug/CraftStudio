import { deflateSync, inflateSync } from 'node:zlib'
import { AppError } from './errors'

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

export interface DecodedPng {
  width: number
  height: number
  pixels: Uint8ClampedArray
}

export function encodePngRgba(width: number, height: number, pixels: ArrayLike<number>): Buffer {
  if (width < 1 || height < 1 || width > 256 || height > 256) {
    throw new AppError({
      code: 'VALIDATION',
      message: 'PNG size must be between 1×1 and 256×256.',
      action: 'Use the 16 or 32 texture presets.'
    })
  }
  if (pixels.length !== width * height * 4) {
    throw new AppError({
      code: 'VALIDATION',
      message: 'RGBA buffer length does not match width×height.',
      action: 'Re-export the texture from the editor.'
    })
  }
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0
    const src = y * width * 4
    for (let x = 0; x < width * 4; x++) {
      raw[y * stride + 1 + x] = pixels[src + x] ?? 0
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

function unfilter(filter: number, line: Buffer, prior: Buffer, bpp: number): Buffer {
  const out = Buffer.alloc(line.length)
  for (let i = 0; i < line.length; i++) {
    const raw = line[i]!
    const left = i >= bpp ? out[i - bpp]! : 0
    const up = prior[i] ?? 0
    const upLeft = i >= bpp ? (prior[i - bpp] ?? 0) : 0
    let value = raw
    if (filter === 1) value = raw + left
    else if (filter === 2) value = raw + up
    else if (filter === 3) value = raw + Math.floor((left + up) / 2)
    else if (filter === 4) value = raw + paeth(left, up, upLeft)
    else if (filter !== 0) {
      throw new AppError({
        code: 'VALIDATION',
        message: `Unsupported PNG filter ${filter}.`,
        action: 'Export a standard 8-bit PNG from the editor or a common paint tool.'
      })
    }
    out[i] = value & 0xff
  }
  return out
}

export function decodePng(data: Buffer): DecodedPng {
  if (data.length < 8 || !data.subarray(0, 8).equals(PNG_SIG)) {
    throw new AppError({
      code: 'VALIDATION',
      message: 'File is not a PNG.',
      action: 'Import an 8-bit PNG. The editor does not invent pixels from model text.'
    })
  }
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat: Buffer[] = []
  let palette: Buffer | null = null

  while (offset + 8 <= data.length) {
    const length = data.readUInt32BE(offset)
    const type = data.subarray(offset + 4, offset + 8).toString('ascii')
    const payload = data.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = payload.readUInt32BE(0)
      height = payload.readUInt32BE(4)
      bitDepth = payload[8]!
      colorType = payload[9]!
    } else if (type === 'PLTE') {
      palette = payload
    } else if (type === 'IDAT') {
      idat.push(payload)
    } else if (type === 'IEND') {
      break
    }
  }

  if (width < 1 || height < 1 || width > 256 || height > 256) {
    throw new AppError({
      code: 'VALIDATION',
      message: 'PNG is outside the supported 1–256 size range.',
      action: 'Use a 16×16 or 32×32 item texture.'
    })
  }
  if (bitDepth !== 8) {
    throw new AppError({
      code: 'VALIDATION',
      message: 'Only 8-bit PNGs are supported.',
      action: 'Re-export the texture as an 8-bit PNG.'
    })
  }

  const inflated = inflateSync(Buffer.concat(idat))
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 1
  const bpp = colorType === 3 ? 1 : channels
  const stride = width * bpp
  const pixels = new Uint8ClampedArray(width * height * 4)
  let src = 0
  let prior: Buffer = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const filter = inflated[src]!
    const line = inflated.subarray(src + 1, src + 1 + stride)
    src += 1 + stride
    const recon = unfilter(filter, Buffer.from(line), prior, bpp)
    prior = Buffer.from(recon)
    for (let x = 0; x < width; x++) {
      const dest = (y * width + x) * 4
      if (colorType === 6) {
        pixels[dest] = recon[x * 4]!
        pixels[dest + 1] = recon[x * 4 + 1]!
        pixels[dest + 2] = recon[x * 4 + 2]!
        pixels[dest + 3] = recon[x * 4 + 3]!
      } else if (colorType === 2) {
        pixels[dest] = recon[x * 3]!
        pixels[dest + 1] = recon[x * 3 + 1]!
        pixels[dest + 2] = recon[x * 3 + 2]!
        pixels[dest + 3] = 255
      } else if (colorType === 0) {
        const v = recon[x]!
        pixels[dest] = v
        pixels[dest + 1] = v
        pixels[dest + 2] = v
        pixels[dest + 3] = 255
      } else if (colorType === 4) {
        const v = recon[x * 2]!
        pixels[dest] = v
        pixels[dest + 1] = v
        pixels[dest + 2] = v
        pixels[dest + 3] = recon[x * 2 + 1]!
      } else if (colorType === 3 && palette) {
        const idx = recon[x]! * 3
        pixels[dest] = palette[idx] ?? 0
        pixels[dest + 1] = palette[idx + 1] ?? 0
        pixels[dest + 2] = palette[idx + 2] ?? 0
        pixels[dest + 3] = 255
      } else {
        throw new AppError({
          code: 'VALIDATION',
          message: `Unsupported PNG color type ${colorType}.`,
          action: 'Import RGB, RGBA, grayscale, or indexed 8-bit PNG.'
        })
      }
    }
  }
  return { width, height, pixels }
}
