import { mkdtemp, rm } from 'node:fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatActivityExport, previewText, redactSecrets } from '../src/shared/activity'
import {
  compactTemplateHint,
  isResourceExhaustionMessage,
  OLLAMA_STREAM_CONTENT_CAP
} from '../src/shared/ollamaLimits'
import { SETTINGS_SCHEMA_VERSION } from '../src/shared/types'
import { ActivityService } from '../src/main/services/activityService'
import { GenerationService } from '../src/main/services/generationService'
import { OllamaService, readOllamaStream } from '../src/main/services/ollamaService'
import { ProjectService } from '../src/main/services/projectService'
import { SettingsService } from '../src/main/services/settingsService'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

function ndjsonResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  let i = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= lines.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(`${lines[i]}\n`))
      i += 1
    }
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } })
}

describe('Ollama check vs inference', () => {
  it('check() only calls GET /api/tags and never /api/chat or /api/generate', async () => {
    const urls: string[] = []
    globalThis.fetch = vi.fn(async (input: URL | RequestInfo) => {
      urls.push(String(input))
      return new Response(JSON.stringify({ models: [{ name: 'llama3.2:latest' }] }), { status: 200 })
    }) as typeof fetch
    await new OllamaService().check('http://localhost:11434', 2000)
    expect(urls).toEqual(['http://localhost:11434/api/tags'])
  })

  it('testModel uses a short bounded prompt and the selected model tag', async () => {
    globalThis.fetch = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        model: string
        options: { num_predict: number; num_ctx: number; temperature: number }
        messages: { content: string }[]
      }
      expect(body.model).toBe('tinyllama:latest')
      expect(body.options.num_predict).toBe(8)
      expect(body.options.num_ctx).toBe(512)
      expect(body.options.temperature).toBe(0)
      expect(body.messages.some((message) => message.content === 'ping')).toBe(true)
      return ndjsonResponse([JSON.stringify({ message: { content: 'pong' } })])
    }) as typeof fetch
    const result = await new OllamaService().testModel('http://localhost:11434', 'tinyllama:latest')
    expect(result.model).toBe('tinyllama:latest')
    expect(result.reply).toMatch(/pong/)
    expect(result.settings.numPredict).toBe(8)
  })

  it('unload posts keep_alive 0 for the named model only', async () => {
    globalThis.fetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      expect(String(input)).toBe('http://localhost:11434/api/generate')
      const body = JSON.parse(String(init?.body)) as { model: string; keep_alive: number; prompt: string }
      expect(body.model).toBe('tinyllama:latest')
      expect(body.keep_alive).toBe(0)
      expect(body.prompt).toBe('')
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const result = await new OllamaService().unload('http://localhost:11434', 'tinyllama:latest')
    expect(result.model).toBe('tinyllama:latest')
    expect(result.message).toMatch(/did not unload unrelated/)
  })

  it('does not auto-retry after resource exhaustion', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('cuda OOM: out of memory', { status: 500 })
    })
    globalThis.fetch = fetchMock as typeof fetch
    await expect(
      new OllamaService().chatJson({
        endpoint: 'http://localhost:11434',
        model: 'huge',
        timeoutMs: 2000,
        numPredict: 32,
        numCtx: 512,
        messages: [{ role: 'user', content: 'x' }]
      })
    ).rejects.toMatchObject({ message: expect.stringMatching(/will not auto-retry/) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('bounds streamed content and cancels the reader', async () => {
    const huge = 'x'.repeat(OLLAMA_STREAM_CONTENT_CAP + 80)
    const result = await readOllamaStream(ndjsonResponse([JSON.stringify({ message: { content: huge } })]))
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(OLLAMA_STREAM_CONTENT_CAP)
  })
})

describe('settings schema 4 defaults', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('creates schema 4 with lowered context/output defaults and opt-in full AI logs', async () => {
    const userData = await mkdtemp(path.join(os.tmpdir(), 'cs-settings4-'))
    temps.push(userData)
    const settings = new SettingsService({ userDataPath: userData })
    const got = await settings.get()
    expect(got.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
    expect(got.schemaVersion).toBe(4)
    expect(got.ollamaNumPredict).toBe(1024)
    expect(got.ollamaNumCtx).toBe(2048)
    expect(got.persistFullAiLogs).toBe(false)
    expect(got.activityRetentionHours).toBe(48)
  })
})

describe('generation request ids and cancellation', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('rejects overlapping generateSpec and ignores a late cancelled response', async () => {
    const userData = await mkdtemp(path.join(os.tmpdir(), 'cs-gen-lock-'))
    const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'cs-gen-lock-p-'))
    temps.push(userData, projectsRoot)
    const settings = new SettingsService({ userDataPath: userData })
    await settings.update({ projectsPath: projectsRoot, ollamaModel: 'tinyllama:latest' })
    const projects = new ProjectService(settings, () => new Date('2026-09-18T15:00:00.000Z'))
    const ollama = new OllamaService()
    let resolveChat: ((value: string) => void) | undefined
    vi.spyOn(ollama, 'chatJson').mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveChat = resolve
        })
    )
    const generation = new GenerationService(projects, settings, ollama)
    const created = await projects.create({
      name: 'Legendary Mace',
      description: 'A heavy legendary mace',
      type: 'mod',
      platform: 'fabric',
      minecraftVersion: '1.21.1'
    })

    const first = generation.generateSpec(created.manifest.id, 'legendary mace with a unique smash', 'ollama')
    await expect(
      generation.generateSpec(created.manifest.id, 'second overlapping', 'ollama')
    ).rejects.toMatchObject({ code: 'INFERENCE_BUSY' })
    await vi.waitFor(() => expect(ollama.chatJson).toHaveBeenCalled())

    generation.cancelGeneration()
    resolveChat?.('{"not":"used"}')
    await expect(first).rejects.toMatchObject({ code: 'GENERATION_CANCELLED' })

    const second = await generation.generateSpec(created.manifest.id, 'simple pebble item', 'template')
    expect(second.success).toBe(true)
    expect(second.requestId).toMatch(/[0-9a-f-]{16}/)
    expect(second.usedOllama).toBe(false)
  })
})

describe('activity bus', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('redacts secrets, bounds previews, coalesces streaming, and exports honestly', () => {
    expect(redactSecrets('Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz')).toMatch(/redacted/)
    const preview = previewText('x'.repeat(800), 500, false)
    expect(preview.truncated).toBe(true)
    expect(preview.content.length).toBeLessThan(800)
    expect(compactTemplateHint({ items: [{ id: 'mace' }], blocks: [], mobs: [], worldgen: [] })).toBe('items=mace')
    expect(isResourceExhaustionMessage('CUDA OOM vram')).toBe(true)
  })

  it('keeps a single in-memory feed and does not invent progress', async () => {
    const userData = await mkdtemp(path.join(os.tmpdir(), 'cs-activity-'))
    temps.push(userData)
    const activity = new ActivityService(userData)
    const seen: string[] = []
    const off = activity.subscribe((event) => seen.push(event.title))
    activity.record({
      channel: 'ai',
      requestId: 'r1',
      title: 'Requesting the Legendary Mace specification.',
      status: 'streaming',
      output: 'a'
    })
    activity.record({
      channel: 'ai',
      requestId: 'r1',
      title: 'Streaming the Legendary Mace specification.',
      status: 'streaming',
      output: 'ab'
    })
    activity.record({
      channel: 'results',
      requestId: 'r1',
      title: 'Validated the specification.',
      status: 'success'
    })
    expect(activity.list()).toHaveLength(2)
    expect(seen).toEqual([
      'Requesting the Legendary Mace specification.',
      'Streaming the Legendary Mace specification.',
      'Validated the specification.'
    ])
    const exported = formatActivityExport(activity.list())
    expect(exported).toMatch(/does not grant the ability to run arbitrary commands/)
    expect(exported).not.toMatch(/75%/)
    off()
    activity.clearView()
    expect(activity.list()).toEqual([])
  })
})
