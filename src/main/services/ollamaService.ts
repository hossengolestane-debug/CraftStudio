import { AppError } from '../../shared/errors'
import { DEFAULT_OLLAMA_ENDPOINT, type OllamaModel, type OllamaStatus } from '../../shared/types'

export function normalizeOllamaEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new AppError({
      code: 'VALIDATION',
      message: 'Ollama endpoint is not a valid URL.',
      action: 'Use a local address such as http://localhost:11434.',
      details: endpoint
    })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError({
      code: 'VALIDATION',
      message: 'Ollama endpoint must start with http:// or https://.',
      action: 'CraftStudio talks only to the endpoint you configure. There is no cloud fallback.',
      details: endpoint
    })
  }

  return parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, ''))
}

function unavailable(endpoint: string, _details: string, cancelled = false): OllamaStatus {
  if (cancelled) {
    return {
      connected: false,
      endpoint,
      models: [],
      message: 'The Ollama check was cancelled.',
      recovery: 'Run the check again when you are ready.'
    }
  }

  return {
    connected: false,
    endpoint,
    models: [],
    message: 'Ollama is not reachable at this endpoint.',
    recovery:
      'Start Ollama locally, confirm the endpoint in Settings, and try again. CraftStudio does not fall back to any cloud model host.'
  }
}

function parseModels(payload: unknown): OllamaModel[] {
  if (!payload || typeof payload !== 'object' || !('models' in payload)) {
    return []
  }
  const models = (payload as { models: unknown }).models
  if (!Array.isArray(models)) {
    return []
  }
  const parsed: OllamaModel[] = []
  for (const model of models) {
    if (!model || typeof model !== 'object') {
      continue
    }
    const record = model as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name : typeof record.model === 'string' ? record.model : ''
    if (!name) {
      continue
    }
    parsed.push({
      name,
      size: typeof record.size === 'number' ? record.size : undefined,
      modifiedAt: typeof record.modified_at === 'string' ? record.modified_at : undefined
    })
  }
  return parsed
}

export interface ChatJsonOptions {
  endpoint: string
  model: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  timeoutMs: number
  numPredict: number
  numCtx: number
  format?: Record<string, unknown> | 'json'
  onChunk?: (text: string) => void
}

export async function readOllamaStream(
  response: Response,
  onChunk?: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  if (!response.body) {
    return await response.text()
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  while (true) {
    if (signal?.aborted) {
      throw new DOMException('The Ollama request was cancelled.', 'AbortError')
    }
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }
      try {
        const parsed = JSON.parse(trimmed) as { message?: { content?: string }; response?: string }
        const piece = parsed.message?.content ?? parsed.response ?? ''
        if (piece) {
          content += piece
          onChunk?.(piece)
        }
      } catch {
        content += trimmed
        onChunk?.(trimmed)
      }
    }
  }
  return content
}

export class OllamaService {
  private controller: AbortController | null = null

  cancel(): void {
    this.controller?.abort()
    this.controller = null
  }

  async check(endpoint = DEFAULT_OLLAMA_ENDPOINT, timeoutMs = 8000): Promise<OllamaStatus> {
    const normalized = normalizeOllamaEndpoint(endpoint)
    this.cancel()
    const controller = new AbortController()
    this.controller = controller
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${normalized}/api/tags`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      })

      if (!response.ok) {
        return {
          ...unavailable(normalized, `HTTP ${response.status}`),
          message: `Ollama responded with HTTP ${response.status}.`,
          recovery: 'Confirm the endpoint is a local Ollama server and that /api/tags is available.'
        }
      }

      const payload: unknown = await response.json()
      const models = parseModels(payload)
      return {
        connected: true,
        endpoint: normalized,
        models,
        message:
          models.length > 0
            ? `Connected. ${models.length} local model${models.length === 1 ? '' : 's'} installed.`
            : 'Connected, but no models are installed yet.',
        recovery:
          models.length > 0
            ? 'Pick a local model in Settings or Design. CraftStudio does not fall back to any cloud host.'
            : 'Pull a model with `ollama pull <name>` in a terminal. CraftStudio will not download models for you.'
      }
    } catch (error) {
      const cancelled = controller.signal.aborted
      const name = error instanceof Error ? error.name : ''
      if (cancelled || name === 'AbortError') {
        return unavailable(normalized, 'aborted', true)
      }
      return unavailable(normalized, error instanceof Error ? error.stack ?? error.message : String(error))
    } finally {
      clearTimeout(timeout)
      if (this.controller === controller) {
        this.controller = null
      }
    }
  }

  async chatJson(options: ChatJsonOptions): Promise<string> {
    const normalized = normalizeOllamaEndpoint(options.endpoint)
    this.cancel()
    const controller = new AbortController()
    this.controller = controller
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

    try {
      const response = await fetch(`${normalized}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: options.model,
          stream: true,
          format: options.format ?? 'json',
          options: {
            num_predict: options.numPredict,
            num_ctx: options.numCtx,
            temperature: 0.1
          },
          messages: options.messages
        })
      })

      if (!response.ok) {
        throw new AppError({
          code: 'OLLAMA_UNAVAILABLE',
          message: `Ollama chat returned HTTP ${response.status}.`,
          action: 'Confirm the local model name and that Ollama is running. There is no cloud fallback.',
          details: await response.text().catch(() => '')
        })
      }

      const text = await readOllamaStream(response, options.onChunk, controller.signal)
      if (!text.trim()) {
        throw new AppError({
          code: 'GENERATION_FAILED',
          message: 'Ollama returned an empty generation.',
          action: 'Try another local model or generate from the trusted template only.'
        })
      }
      return text
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      const cancelled = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
      if (cancelled) {
        throw new AppError({
          code: 'GENERATION_CANCELLED',
          message: 'Generation was cancelled or timed out.',
          action: 'Run generate again, raise the timeout in Settings, or use template-only generation.'
        })
      }
      throw new AppError({
        code: 'OLLAMA_UNAVAILABLE',
        message: 'Ollama is not reachable for generation.',
        action:
          'Start Ollama locally or use “Generate from template” for a simple item. CraftStudio does not fall back to the cloud.',
        details: error instanceof Error ? error.stack ?? error.message : String(error)
      })
    } finally {
      clearTimeout(timeout)
      if (this.controller === controller) {
        this.controller = null
      }
    }
  }
}
