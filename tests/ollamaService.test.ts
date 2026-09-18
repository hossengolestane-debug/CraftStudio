import { afterEach, describe, expect, it, vi } from 'vitest'
import { OllamaService } from '../src/main/services/ollamaService'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('ollama service', () => {
  it('reports connected and lists models from /api/tags', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          models: [{ name: 'llama3.2:latest', size: 1, modified_at: '2026-01-01T00:00:00Z' }]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }) as typeof fetch

    const status = await new OllamaService().check('http://localhost:11434', 2000)
    expect(status.connected).toBe(true)
    expect(status.models.map((model) => model.name)).toEqual(['llama3.2:latest'])
    expect(status.message).toMatch(/Connected/)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('reports not connected without inventing generation success', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED')
    }) as typeof fetch

    const status = await new OllamaService().check('http://127.0.0.1:11434', 2000)
    expect(status.connected).toBe(false)
    expect(status.models).toEqual([])
    expect(status.recovery).toMatch(/does not fall back/)
  })

  it('can cancel an in-flight check', async () => {
    const service = new OllamaService()
    globalThis.fetch = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    }) as typeof fetch

    const pending = service.check('http://localhost:11434', 30_000)
    service.cancelCheck()
    const status = await pending
    expect(status.connected).toBe(false)
    expect(status.message).toMatch(/cancelled/)
  })

  it('does not cancel a connection check when cancel() is used for inference', async () => {
    const service = new OllamaService()
    let aborted = false
    globalThis.fetch = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
        setTimeout(() => {
          resolve(
            new Response(JSON.stringify({ models: [{ name: 'tiny' }] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          )
        }, 20)
      })
    }) as typeof fetch

    const pending = service.check('http://localhost:11434', 5000)
    service.cancel()
    const status = await pending
    expect(aborted).toBe(false)
    expect(status.connected).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('rejects a second overlapping inference and never silently starts another chat', async () => {
    const service = new OllamaService()
    globalThis.fetch = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    }) as typeof fetch

    const first = service.chatJson({
      endpoint: 'http://localhost:11434',
      model: 'tiny',
      timeoutMs: 5000,
      numPredict: 32,
      numCtx: 512,
      messages: [{ role: 'user', content: 'hi' }]
    })
    await expect(
      service.chatJson({
        endpoint: 'http://localhost:11434',
        model: 'tiny',
        timeoutMs: 5000,
        numPredict: 32,
        numCtx: 512,
        messages: [{ role: 'user', content: 'second' }]
      })
    ).rejects.toMatchObject({ code: 'INFERENCE_BUSY' })
    service.cancelInference()
    await expect(first).rejects.toMatchObject({ code: 'GENERATION_CANCELLED' })
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toContain('/api/chat')
  })

  it('reports GENERATION_TIMEOUT when the bounded wait expires', async () => {
    const service = new OllamaService()
    globalThis.fetch = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    }) as typeof fetch

    await expect(
      service.chatJson({
        endpoint: 'http://localhost:11434',
        model: 'qwen2.5-coder:7b',
        timeoutMs: 25,
        numPredict: 8,
        numCtx: 512,
        messages: [{ role: 'user', content: 'ping' }]
      })
    ).rejects.toMatchObject({ code: 'GENERATION_TIMEOUT' })
  })

  it('keeps GENERATION_CANCELLED distinct from timeout', async () => {
    const service = new OllamaService()
    globalThis.fetch = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    }) as typeof fetch

    const pending = service.chatJson({
      endpoint: 'http://localhost:11434',
      model: 'qwen2.5-coder:7b',
      timeoutMs: 30_000,
      numPredict: 8,
      numCtx: 512,
      messages: [{ role: 'user', content: 'ping' }]
    })
    service.cancelInference()
    await expect(pending).rejects.toMatchObject({ code: 'GENERATION_CANCELLED' })
  })
})
