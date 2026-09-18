import { randomUUID } from 'node:crypto'
import { AppError } from '../../shared/errors'
import {
  OLLAMA_CHECK_TIMEOUT_CAP_MS,
  OLLAMA_PROGRESS_BATCH_MS,
  OLLAMA_STREAM_CONTENT_CAP,
  OLLAMA_TEST_NUM_CTX,
  OLLAMA_TEST_NUM_PREDICT,
  OLLAMA_TEST_TIMEOUT_MS,
  isResourceExhaustionMessage
} from '../../shared/ollamaLimits'
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

export interface PreInferenceDiagnostic {
  endpoint: string
  operation: string
  model: string
  requestSettings: { numPredict: number; numCtx: number; timeoutMs: number; temperature: number }
  promptSizeChars: number
  activeRequestCount: number
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
  requestId?: string
  operation?: string
}

export interface OllamaInferenceState {
  requestId: string
  model: string
  operation: string
}

export interface ModelTestResult {
  requestId: string
  model: string
  reply: string
  settings: { numPredict: number; numCtx: number; timeoutMs: number; temperature: number }
  truncated: boolean
}

export async function readOllamaStream(
  response: Response,
  onChunk?: (text: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) {
    const text = await response.text()
    return { text, truncated: false }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let truncated = false
  let pending = ''
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  const flush = (): void => {
    if (!pending) {
      return
    }
    const piece = pending
    pending = ''
    onChunk?.(piece)
  }
  const schedule = (piece: string): void => {
    pending += piece
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null
        flush()
      }, OLLAMA_PROGRESS_BATCH_MS)
    }
  }
  try {
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
      if (buffer.length > OLLAMA_STREAM_CONTENT_CAP) {
        buffer = buffer.slice(-4096)
        truncated = true
      }
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          continue
        }
        try {
          const parsed = JSON.parse(trimmed) as { message?: { content?: string }; response?: string }
          const piece = parsed.message?.content ?? parsed.response ?? ''
          if (piece) {
            if (content.length + piece.length > OLLAMA_STREAM_CONTENT_CAP) {
              content += piece.slice(0, Math.max(0, OLLAMA_STREAM_CONTENT_CAP - content.length))
              truncated = true
              schedule(piece)
              throw new DOMException('bounded', 'BoundError')
            }
            content += piece
            schedule(piece)
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'BoundError') {
            throw error
          }
          if (content.length < OLLAMA_STREAM_CONTENT_CAP) {
            content += trimmed.slice(0, OLLAMA_STREAM_CONTENT_CAP - content.length)
            schedule(trimmed)
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'BoundError') {
      truncated = true
    } else {
      throw error
    }
  } finally {
    if (flushTimer) {
      clearTimeout(flushTimer)
    }
    flush()
    try {
      await reader.cancel()
    } catch {
      // already closed
    }
  }
  return { text: content, truncated }
}

export class OllamaService {
  private checkController: AbortController | null = null
  private inferController: AbortController | null = null
  private activeInference: OllamaInferenceState | null = null

  constructor(private readonly onPreInference?: (diagnostic: PreInferenceDiagnostic) => void) {}

  getActiveInference(): OllamaInferenceState | null {
    return this.activeInference
  }

  cancelCheck(): void {
    this.checkController?.abort()
    this.checkController = null
  }

  cancelInference(): void {
    this.inferController?.abort()
    this.inferController = null
    this.activeInference = null
  }

  cancel(): void {
    this.cancelInference()
  }

  async check(endpoint = DEFAULT_OLLAMA_ENDPOINT, timeoutMs = 8000): Promise<OllamaStatus> {
    const normalized = normalizeOllamaEndpoint(endpoint)
    this.cancelCheck()
    const controller = new AbortController()
    this.checkController = controller
    const capped = Math.min(Math.max(1000, timeoutMs), OLLAMA_CHECK_TIMEOUT_CAP_MS)
    const timeout = setTimeout(() => controller.abort(), capped)

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
            ? `Connected. ${models.length} local model${models.length === 1 ? '' : 's'} installed. This check did not load a model or start inference.`
            : 'Connected, but no models are installed yet. This check did not load a model.',
        recovery:
          models.length > 0
            ? 'Pick a local model in Settings. CraftStudio does not fall back to any cloud host. Request limits here do not control other programs using Ollama.'
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
      if (this.checkController === controller) {
        this.checkController = null
      }
    }
  }

  async testModel(endpoint: string, model: string): Promise<ModelTestResult> {
    const requestId = randomUUID()
    const reply = await this.chatJson({
      endpoint,
      model,
      requestId,
      operation: 'test-model',
      timeoutMs: OLLAMA_TEST_TIMEOUT_MS,
      numPredict: OLLAMA_TEST_NUM_PREDICT,
      numCtx: OLLAMA_TEST_NUM_CTX,
      format: undefined,
      messages: [
        { role: 'system', content: 'Reply with the single word pong.' },
        { role: 'user', content: 'ping' }
      ]
    })
    return {
      requestId,
      model,
      reply: reply.slice(0, 200),
      settings: {
        numPredict: OLLAMA_TEST_NUM_PREDICT,
        numCtx: OLLAMA_TEST_NUM_CTX,
        timeoutMs: OLLAMA_TEST_TIMEOUT_MS,
        temperature: 0
      },
      truncated: reply.length > 200
    }
  }

  async unload(endpoint: string, model: string): Promise<{ model: string; message: string }> {
    if (this.activeInference) {
      throw new AppError({
        code: 'INFERENCE_BUSY',
        message: 'Cannot unload while a CraftStudio inference is running.',
        action: 'Cancel the active request first.'
      })
    }
    const normalized = normalizeOllamaEndpoint(endpoint)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`${normalized}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: '',
          stream: false,
          keep_alive: 0
        })
      })
      if (!response.ok) {
        throw new AppError({
          code: 'OLLAMA_UNAVAILABLE',
          message: `Ollama unload returned HTTP ${response.status}.`,
          action: 'Confirm Ollama is running and the model tag is exact.',
          details: await response.text().catch(() => '')
        })
      }
      return {
        model,
        message: `Asked Ollama to unload ${model} (keep_alive=0). Other apps using this model may hitch or reload it. CraftStudio did not unload unrelated models. The server may keep the weights until it processes the request.`
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError({
        code: 'OLLAMA_UNAVAILABLE',
        message: 'Ollama did not accept the unload request.',
        action: 'Start Ollama locally. Unload is best-effort; CraftStudio cannot force the OS to free VRAM.',
        details: error instanceof Error ? error.message : String(error)
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  async chatJson(options: ChatJsonOptions): Promise<string> {
    const normalized = normalizeOllamaEndpoint(options.endpoint)
    const temperature = options.operation === 'test-model' ? 0 : 0.1
    const diagnostic: PreInferenceDiagnostic = {
      endpoint: normalized,
      operation: options.operation ?? 'chat',
      model: options.model,
      requestSettings: {
        numPredict: options.numPredict,
        numCtx: options.numCtx,
        timeoutMs: options.timeoutMs,
        temperature
      },
      promptSizeChars: options.messages.reduce((sum, message) => sum + message.content.length, 0),
      activeRequestCount: this.activeInference ? 1 : 0
    }
    console.log(`[craftstudio] pre-inference ${JSON.stringify(diagnostic)}`)
    this.onPreInference?.(diagnostic)
    if (this.activeInference) {
      throw new AppError({
        code: 'INFERENCE_BUSY',
        message: 'Another Ollama inference is already running.',
        action: 'Wait for it to finish or cancel it. CraftStudio allows one active inference at a time.'
      })
    }
    const requestId = options.requestId ?? randomUUID()
    const controller = new AbortController()
    this.inferController = controller
    this.activeInference = {
      requestId,
      model: options.model,
      operation: options.operation ?? 'chat'
    }
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs)

    try {
      const response = await fetch(`${normalized}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: options.model,
          stream: true,
          ...(options.format !== undefined ? { format: options.format } : {}),
          options: {
            num_predict: options.numPredict,
            num_ctx: options.numCtx,
            temperature
          },
          messages: options.messages
        })
      })

      if (!response.ok) {
        const details = await response.text().catch(() => '')
        if (isResourceExhaustionMessage(`${response.status} ${details}`)) {
          throw new AppError({
            code: 'OLLAMA_UNAVAILABLE',
            message: 'Ollama reported resource exhaustion. CraftStudio will not auto-retry.',
            action: 'Close other Ollama clients, unload the model, or pick a smaller model. Request limits here do not control other programs.',
            details
          })
        }
        throw new AppError({
          code: 'OLLAMA_UNAVAILABLE',
          message: `Ollama chat returned HTTP ${response.status}.`,
          action: 'Confirm the local model name and that Ollama is running. There is no cloud fallback.',
          details
        })
      }

      const { text } = await readOllamaStream(response, options.onChunk, controller.signal)
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
      const details = error instanceof Error ? error.stack ?? error.message : String(error)
      if (isResourceExhaustionMessage(details)) {
        throw new AppError({
          code: 'OLLAMA_UNAVAILABLE',
          message: 'Ollama ran out of resources. CraftStudio will not auto-retry.',
          action: 'Unload the model or choose a smaller one. This app cannot cap other programs using Ollama.',
          details
        })
      }
      throw new AppError({
        code: 'OLLAMA_UNAVAILABLE',
        message: 'Ollama is not reachable for generation.',
        action:
          'Start Ollama locally or use “Generate from template” for a simple item. CraftStudio does not fall back to the cloud.',
        details
      })
    } finally {
      clearTimeout(timeout)
      if (this.inferController === controller) {
        this.inferController = null
      }
      if (this.activeInference?.requestId === requestId) {
        this.activeInference = null
      }
    }
  }
}
