export const ACTIVITY_CHANNELS = ['ai', 'files', 'build', 'errors', 'results'] as const
export type ActivityChannel = (typeof ACTIVITY_CHANNELS)[number]

export const ACTIVITY_STATUSES = [
  'queued',
  'running',
  'streaming',
  'success',
  'failure',
  'cancelled',
  'paused-display'
] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]

export interface ActivityGenerationSettings {
  model: string
  numPredict: number
  numCtx: number
  temperature: number
  timeoutMs: number
  format?: string
  keepAlive?: string | number
}

export interface ActivityMessagePreview {
  role: 'system' | 'user' | 'assistant'
  content: string
  truncated: boolean
}

export interface ActivityEvent {
  id: string
  requestId?: string
  buildId?: string
  channel: ActivityChannel
  timestamp: string
  title: string
  detail?: string
  status?: ActivityStatus
  elapsedMs?: number
  model?: string
  settings?: ActivityGenerationSettings
  messages?: ActivityMessagePreview[]
  output?: string
  outputTruncated?: boolean
  path?: string
  diff?: string
  command?: string
  args?: string[]
  cwd?: string
  exitCode?: number | null
  cancelled?: boolean
  error?: string
}

export function redactSecrets(text: string): string {
  return text
    .replace(/(authorization:\s*)bearer\s+\S+/gi, '$1bearer [redacted]')
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/sk-[a-zA-Z0-9]{10,}/g, '[redacted]')
}

export function previewText(text: string, max = 500, persistFull = false): { content: string; truncated: boolean } {
  const redacted = redactSecrets(text)
  if (persistFull || redacted.length <= max) {
    return { content: redacted, truncated: false }
  }
  return { content: `${redacted.slice(0, max)}\n…[truncated ${redacted.length - max} chars]`, truncated: true }
}

export function formatActivityExport(events: ActivityEvent[]): string {
  return [
    '# CraftStudio diagnostic activity log',
    '',
    'Contains timestamps, request/build IDs, operation titles, models, generation settings, bounded messages, file paths, diffs, and command lines from allowlisted Gradle tasks.',
    'Secrets are redacted. Full prompts are included only when persistFullAiLogs was enabled when the event was recorded.',
    'This file does not grant the ability to run arbitrary commands.',
    '',
    ...events.map((event) => JSON.stringify(event)),
    ''
  ].join('\n')
}
