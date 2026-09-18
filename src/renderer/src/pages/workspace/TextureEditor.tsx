import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { AppErrorPayload } from '../../../../shared/errors'
import { DEFAULT_PALETTE, parseHexColor, pixelsToPixelSpec } from '../../../../shared/pixelSpec'
import {
  applyTool,
  blankTexture,
  clonePixels,
  hashDefaultTexture,
  nearestResize,
  PixelHistory,
  type TextureTool
} from '../../../../shared/textureCanvas'
import type { TextureLayer } from '../../../../shared/ipc'
import type { ProjectSpec } from '../../../../shared/spec'
import type { ProjectRecord } from '../../../../shared/types'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Badge, Button, Card, Field } from '../../components/ui'
import { asAppError } from '../../lib/errors'

const api = window.craftstudio

export function TextureEditor({ project, spec }: { project: ProjectRecord; spec: ProjectSpec | null }) {
  const items = useMemo(() => spec?.items ?? [], [spec])
  const [itemId, setItemId] = useState(items[0]?.id ?? '')
  const [layer, setLayer] = useState<TextureLayer>('layer0')
  const [size, setSize] = useState<16 | 32>(16)
  const [pixels, setPixels] = useState(() => blankTexture(16, 16))
  const [tool, setTool] = useState<TextureTool>('pencil')
  const [palette, setPalette] = useState<string[]>([...DEFAULT_PALETTE])
  const [colorIndex, setColorIndex] = useState(0)
  const [zoom, setZoom] = useState(16)
  const [grid, setGrid] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const history = useRef(new PixelHistory())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const color = parseHexColor(palette[colorIndex] ?? '#000000')

  const paintCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    canvas.width = size * zoom
    canvas.height = size * zoom
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.imageSmoothingEnabled = false
    const image = ctx.createImageData(size, size)
    image.data.set(pixels)
    const off = document.createElement('canvas')
    off.width = size
    off.height = size
    const offCtx = off.getContext('2d')
    if (!offCtx) {
      return
    }
    offCtx.putImageData(image, 0, 0)
    ctx.fillStyle = '#d7d7d1'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = '#ecece8'
          ctx.fillRect(x * zoom, y * zoom, zoom, zoom)
        }
      }
    }
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height)
    if (grid && zoom >= 8) {
      ctx.strokeStyle = 'rgba(20,20,20,0.25)'
      ctx.lineWidth = 1
      for (let i = 0; i <= size; i++) {
        ctx.beginPath()
        ctx.moveTo(i * zoom + 0.5, 0)
        ctx.lineTo(i * zoom + 0.5, canvas.height)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * zoom + 0.5)
        ctx.lineTo(canvas.width, i * zoom + 0.5)
        ctx.stroke()
      }
    }
  }, [pixels, size, zoom, grid])

  useEffect(() => {
    paintCanvas()
  }, [paintCanvas])

  useEffect(() => {
    if (items[0] && !items.some((item) => item.id === itemId)) {
      setItemId(items[0].id)
    }
  }, [items, itemId])

  useEffect(() => {
    if (!itemId) {
      return
    }
    void api
      .getTexture(project.manifest.id, itemId, layer)
      .then((texture) => {
        history.current = new PixelHistory()
        if (!texture) {
          setSize(16)
          setPixels(blankTexture(16, 16))
          return
        }
        const nextSize = texture.width >= 32 ? 32 : 16
        setSize(nextSize)
        const raw = Uint8ClampedArray.from(texture.pixels)
        setPixels(
          texture.width === nextSize && texture.height === nextSize
            ? raw
            : nearestResize(raw, texture.width, texture.height, nextSize, nextSize)
        )
      })
      .catch((err) => setError(asAppError(err)))
  }, [itemId, layer, project.manifest.id])

  const paintAt = (event: MouseEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * size)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * size)
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return
    }
    setPixels((current) => {
      const next = clonePixels(current)
      applyTool(next, size, size, tool, x, y, color)
      return next
    })
  }

  const commitStroke = (): void => {
    history.current.push(pixels)
  }

  if (!spec || items.length === 0) {
    return (
      <Card>
        <p>Generate and apply a spec on Design first. The texture editor binds to spec item ids.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}
      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Pixel texture editor</h2>
          <p className="mt-1 text-sm text-muted">
            Pencil, eraser, fill, palette, grid, zoom, undo/redo, and PNG import/export. Paint layer0 or a dedicated
            layer1 overlay. Bind handheld + layer1 on Design so pack export includes both. Ollama may suggest colors
            only — it does not draw this image.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Field label="Item" htmlFor="tex-item">
            <select
              id="tex-item"
              className="border border-line bg-white px-3 py-2"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName} ({item.id})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Layer" htmlFor="tex-layer">
            <select
              id="tex-layer"
              className="border border-line bg-white px-3 py-2"
              value={layer}
              onChange={(event) => setLayer(event.target.value === 'layer1' ? 'layer1' : 'layer0')}
            >
              <option value="layer0">layer0 (base)</option>
              <option value="layer1">layer1 (overlay)</option>
            </select>
          </Field>
          <Field label="Size" htmlFor="tex-size">
            <select
              id="tex-size"
              className="border border-line bg-white px-3 py-2"
              value={size}
              onChange={(event) => {
                const next = Number(event.target.value) === 32 ? 32 : 16
                history.current.push(pixels)
                setPixels(nearestResize(pixels, size, size, next, next))
                setSize(next)
              }}
            >
              <option value={16}>16×16</option>
              <option value={32}>32×32</option>
            </select>
          </Field>
          <Field label="Zoom" htmlFor="tex-zoom">
            <select
              id="tex-zoom"
              className="border border-line bg-white px-3 py-2"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            >
              <option value={8}>8×</option>
              <option value={16}>16×</option>
              <option value={24}>24×</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['pencil', 'eraser', 'fill'] as const).map((id) => (
            <Button key={id} variant={tool === id ? 'primary' : 'secondary'} onClick={() => setTool(id)}>
              {id}
            </Button>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              const prev = history.current.undo(pixels)
              if (prev) setPixels(prev)
            }}
          >
            Undo
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const next = history.current.redo(pixels)
              if (next) setPixels(next)
            }}
          >
            Redo
          </Button>
          <Button variant="ghost" onClick={() => setGrid((value) => !value)}>
            {grid ? 'Hide grid' : 'Show grid'}
          </Button>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair border border-line bg-white"
            onMouseDown={(event) => {
              drawing.current = true
              commitStroke()
              paintAt(event)
            }}
            onMouseMove={(event) => {
              if (drawing.current && tool !== 'fill') {
                paintAt(event)
              }
            }}
            onMouseUp={() => {
              drawing.current = false
            }}
            onMouseLeave={() => {
              drawing.current = false
            }}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">Palette</p>
            <div className="grid grid-cols-4 gap-2">
              {palette.map((hex, index) => (
                <button
                  key={`${hex}-${index}`}
                  type="button"
                  className={`h-8 w-8 border ${colorIndex === index ? 'border-ink' : 'border-line'}`}
                  style={{
                    background:
                      hex.length === 9 && hex.endsWith('00')
                        ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                        : hex
                  }}
                  aria-label={`Color ${hex}`}
                  onClick={() => setColorIndex(index)}
                />
              ))}
            </div>
            <label className="block text-sm">
              Custom color
              <input
                type="color"
                className="ml-2 align-middle"
                onChange={(event) => {
                  const next = [...palette]
                  next[colorIndex] = event.target.value
                  setPalette(next)
                }}
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !itemId}
            onClick={() => {
              setBusy(true)
              setError(null)
              const pixelSpec = pixelsToPixelSpec(size, size, pixels)
              void api
                .saveTexture({
                  projectId: project.manifest.id,
                  itemId,
                  layer,
                  width: size,
                  height: size,
                  pixels: Array.from(pixels),
                  pixelSpec
                })
                .then(() =>
                  setNote(
                    `Saved ${layer === 'layer1' ? `${itemId}_layer1.png` : `${itemId}.png`} under craftstudio/textures/. Enable layer1 on the item in Design, then re-apply so the pack and jar include it.`
                  )
                )
                .catch((err) => setError(asAppError(err)))
                .finally(() => setBusy(false))
            }}
          >
            Save to project
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              history.current.push(pixels)
              setPixels(hashDefaultTexture(size, size, itemId || project.manifest.id))
              setNote('Filled a deterministic placeholder from the item id. This is not an AI drawing.')
            }}
          >
            Fill default pattern
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              void api
                .suggestTexturePalette(project.manifest.id, spec.displayName)
                .then((result) => {
                  setPalette(result.palette)
                  setNote(result.note)
                })
                .catch((err) => setError(asAppError(err)))
                .finally(() => setBusy(false))
            }}
          >
            Suggest palette
          </Button>
          <label className="inline-flex items-center border border-line px-3 py-2 text-sm">
            Import PNG
            <input
              type="file"
              accept="image/png"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  const image = new Image()
                  image.onload = () => {
                    const off = document.createElement('canvas')
                    off.width = size
                    off.height = size
                    const ctx = off.getContext('2d')
                    if (!ctx) return
                    ctx.imageSmoothingEnabled = false
                    ctx.clearRect(0, 0, size, size)
                    ctx.drawImage(image, 0, 0, size, size)
                    history.current.push(pixels)
                    setPixels(new Uint8ClampedArray(ctx.getImageData(0, 0, size, size).data))
                    setNote(`Imported ${file.name} and fitted to ${size}×${size}.`)
                  }
                  image.src = String(reader.result)
                }
                reader.readAsDataURL(file)
              }}
            />
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              const canvas = document.createElement('canvas')
              canvas.width = size
              canvas.height = size
              const ctx = canvas.getContext('2d')
              if (!ctx) return
              const image = ctx.createImageData(size, size)
              image.data.set(pixels)
              ctx.putImageData(image, 0, 0)
              canvas.toBlob((blob) => {
                if (!blob) return
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `${itemId || 'texture'}${layer === 'layer1' ? '_layer1' : ''}.png`
                link.click()
                URL.revokeObjectURL(url)
              })
            }}
          >
            Export PNG
          </Button>
        </div>
        {note ? (
          <p role="status" className="text-sm">
            {note}
          </p>
        ) : null}
        {layer === 'layer1' && items.find((item) => item.id === itemId)?.layer1 !== true ? (
          <p className="text-sm">
            This item does not have <code>layer1</code> enabled in Design yet. The PNG still saves; pack export only
            ships it after you toggle layer1 on the item and re-apply.
          </p>
        ) : null}
        <Badge>Transparency: eraser and the last palette swatch are alpha 0</Badge>
      </Card>
    </div>
  )
}
