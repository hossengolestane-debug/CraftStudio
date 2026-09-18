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
      'Start Ollama locally, confirm the endpoint in Settings, and try again. CraftStudio does not fall back to any cloud model host.',
    // details are not part of status; callers can use message + recovery
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
            ? 'Generation is not implemented in Phase 1. Installed models are listed only.'
            : 'Pull a model with `ollama pull <name>` in a terminal. CraftStudio will not download models for you in Phase 1.'
      }
    } catch (error) {
      const cancelled = controller.signal.aborted
      const name = error instanceof Error ? error.name : ''
      if (cancelled || name === 'AbortError') {
        return unavailable(normalized, 'aborted', true)
      }

      return unavailable(
        normalized,
        error instanceof Error ? error.stack ?? error.message : String(error)
      )
    } finally {
      clearTimeout(timeout)
      if (this.controller === controller) {
        this.controller = null
      }
    }
  }
}

export const GENERATION_STUB = {
  available: false as const,
  phase: 'Phase 2' as const,
  message:
    'Structured Ollama generation is not implemented in Phase 1. The app only checks /api/tags and lists local models.'
}
