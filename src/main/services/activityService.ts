import { appendFile, mkdir, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { type ActivityChannel, type ActivityEvent, formatActivityExport } from '../../shared/activity'
import { ACTIVITY_MEMORY_CAP } from '../../shared/ollamaLimits'

export type ActivityListener = (event: ActivityEvent) => void

export class ActivityService {
  private readonly events: ActivityEvent[] = []
  private readonly listeners = new Set<ActivityListener>()

  constructor(private readonly userDataPath: string) {}

  subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  list(retentionHours?: number): ActivityEvent[] {
    if (retentionHours && retentionHours > 0) {
      this.pruneOlderThan(retentionHours)
    }
    return [...this.events]
  }

  clearView(): void {
    this.events.length = 0
  }

  pruneOlderThan(hours: number): void {
    const cutoff = Date.now() - hours * 60 * 60 * 1000
    while (this.events.length > 0) {
      const first = this.events[0]
      if (!first || Date.parse(first.timestamp) >= cutoff) {
        break
      }
      this.events.shift()
    }
  }

  record(partial: Omit<ActivityEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): ActivityEvent {
    const event: ActivityEvent = {
      id: partial.id ?? randomUUID(),
      timestamp: partial.timestamp ?? new Date().toISOString(),
      ...partial
    }
    const last = this.events[this.events.length - 1]
    if (
      event.status === 'streaming' &&
      last &&
      last.status === 'streaming' &&
      last.requestId &&
      last.requestId === event.requestId
    ) {
      this.events[this.events.length - 1] = event
    } else {
      this.events.push(event)
    }
    if (this.events.length > ACTIVITY_MEMORY_CAP) {
      this.events.splice(0, this.events.length - ACTIVITY_MEMORY_CAP)
    }
    for (const listener of this.listeners) {
      listener(event)
    }
    void this.appendDisk(event)
    return event
  }

  exportText(): string {
    return formatActivityExport(this.events)
  }

  private async appendDisk(event: ActivityEvent): Promise<void> {
    try {
      const dir = path.join(this.userDataPath, 'activity')
      await mkdir(dir, { recursive: true })
      const file = path.join(dir, 'activity.jsonl')
      await appendFile(file, `${JSON.stringify(event)}\n`, 'utf8')
      await this.rotate(dir)
    } catch {
      // Diagnostics must never break generation or builds.
    }
  }

  private async rotate(dir: string): Promise<void> {
    const names = await readdir(dir).catch(() => [])
    if (names.length <= 8) {
      return
    }
    const extra = names.filter((name) => name.startsWith('activity') && name.endsWith('.jsonl')).sort()
    while (extra.length > 4) {
      const name = extra.shift()
      if (name) {
        await unlink(path.join(dir, name)).catch(() => undefined)
      }
    }
  }
}

export function activityTitle(channel: ActivityChannel, title: string): Pick<ActivityEvent, 'channel' | 'title'> {
  return { channel, title }
}
