export type AppErrorCode =
  | 'PATH_ESCAPE'
  | 'MANIFEST_INVALID'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_EXISTS'
  | 'SETTINGS_INVALID'
  | 'UNSUPPORTED_COMBINATION'
  | 'OLLAMA_UNAVAILABLE'
  | 'OLLAMA_CANCELLED'
  | 'VALIDATION'
  | 'SPEC_INVALID'
  | 'GENERATION_FAILED'
  | 'GENERATION_CANCELLED'
  | 'ADAPTER_UNSUPPORTED'
  | 'JAVA_MISSING'
  | 'BUILD_FAILED'
  | 'BUILD_GATED'
  | 'EXPORT_FAILED'
  | 'TERMS_REQUIRED'
  | 'EVIDENCE_REQUIRED'
  | 'IO'
  | 'UNKNOWN'

export interface AppErrorPayload {
  code: AppErrorCode
  message: string
  action: string
  details?: string
}

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly action: string
  readonly details?: string

  constructor(payload: AppErrorPayload) {
    super(payload.message)
    this.name = 'AppError'
    this.code = payload.code
    this.action = payload.action
    this.details = payload.details
  }

  toPayload(): AppErrorPayload {
    return {
      code: this.code,
      message: this.message,
      action: this.action,
      details: this.details
    }
  }
}

export function toAppError(error: unknown, fallback?: Partial<AppErrorPayload>): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    return new AppError({
      code: fallback?.code ?? 'UNKNOWN',
      message: fallback?.message ?? error.message,
      action: fallback?.action ?? 'Review the technical details and try again.',
      details: error.stack ?? error.message
    })
  }

  return new AppError({
    code: fallback?.code ?? 'UNKNOWN',
    message: fallback?.message ?? 'Something unexpected happened.',
    action: fallback?.action ?? 'Try the action again. If it keeps failing, check the technical details.',
    details: String(error)
  })
}

export function isAppErrorPayload(value: unknown): value is AppErrorPayload {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.code === 'string' &&
    typeof record.message === 'string' &&
    typeof record.action === 'string'
  )
}
