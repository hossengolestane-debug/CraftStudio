import { AppError, isAppErrorPayload, type AppErrorPayload } from '../../../shared/errors'

export function asAppError(error: unknown): AppErrorPayload {
  if (error instanceof AppError) {
    return error.toPayload()
  }
  if (isAppErrorPayload(error)) {
    return error
  }
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN',
      message: error.message,
      action: 'Try again. If it keeps failing, expand the technical details.',
      details: error.stack
    }
  }
  return {
    code: 'UNKNOWN',
    message: 'Something unexpected happened.',
    action: 'Try again or restart the app.',
    details: String(error)
  }
}
