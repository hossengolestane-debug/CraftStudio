import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityEvent } from '../../../shared/activity'
import { Button } from './ui'
import { useActivityFeed, type ActivityFilter } from '../lib/useActivityFeed'

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ai', label: 'AI' },
  { id: 'files', label: 'Files' },
  { id: 'build', label: 'Build' },
  { id: 'errors', label: 'Errors' }
]

const ROW_ESTIMATE = 72
const WINDOW_PAD = 6

function copyText(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => undefined)
}

function eventCopy(event: ActivityEvent): string {
  return JSON.stringify(event, null, 2)
}

export function LiveActivityFeed({
  enabled,
  compact = false
}: {
  enabled: boolean
  compact?: boolean
}) {
  const feed = useActivityFeed(enabled)
  const setFollow = feed.setFollow
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(360)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exportNote, setExportNote] = useState<string | null>(null)

  useEffect(() => {
    const node = scrollerRef.current
    if (!node) {
      return
    }
    const onScroll = (): void => {
      setScrollTop(node.scrollTop)
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight
      if (distance > 48) {
        setFollow(false)
      } else if (distance < 8) {
        setFollow(true)
      }
    }
    node.addEventListener('scroll', onScroll, { passive: true })
    setViewport(node.clientHeight || 360)
    return () => node.removeEventListener('scroll', onScroll)
  }, [setFollow])

  useEffect(() => {
    const node = scrollerRef.current
    if (!node || !feed.follow || feed.paused) {
      return
    }
    node.scrollTop = node.scrollHeight
  }, [feed.filtered, feed.follow, feed.paused])

  const start = Math.max(0, Math.floor(scrollTop / ROW_ESTIMATE) - WINDOW_PAD)
  const visibleCount = Math.ceil(viewport / ROW_ESTIMATE) + WINDOW_PAD * 2
  const slice = feed.filtered.slice(start, start + visibleCount)
  const topPad = start * ROW_ESTIMATE
  const bottomPad = Math.max(0, (feed.filtered.length - start - slice.length) * ROW_ESTIMATE)

  const related = useMemo(() => {
    const map = new Map<string, number>()
    for (const event of feed.events) {
      const key = event.requestId ?? event.buildId
      if (key) {
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
    return map
  }, [feed.events])

  return (
    <div className={`flex min-h-0 flex-col ${compact ? 'h-72' : 'h-full'}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper-raised px-3 py-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`px-2 py-1 text-sm ${
              feed.filter === item.id ? 'bg-ink text-white' : 'border border-line bg-white'
            }`}
            aria-pressed={feed.filter === item.id}
            onClick={() => feed.setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => feed.setPaused(!feed.paused)}
        >
          {feed.paused ? 'Resume display' : 'Pause display'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => feed.setFollow(true)}>
          Follow latest
        </Button>
        <Button type="button" variant="ghost" onClick={() => void feed.clearView()}>
          Clear view
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const text = feed.filtered.map(eventCopy).join('\n')
            copyText(text || 'No activity events.')
          }}
        >
          Copy
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void window.craftstudio
              .exportActivity()
              .then((result) => setExportNote(result.message))
              .catch((error) => setExportNote(error instanceof Error ? error.message : String(error)))
          }}
        >
          Export diagnostic log
        </Button>
        <p className="text-xs text-muted">
          Pause display does not cancel generation or builds. {feed.filtered.length} shown / {feed.events.length} in
          memory.
        </p>
      </div>
      {exportNote ? <p className="px-3 py-1 text-xs">{exportNote}</p> : null}
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto bg-[#f7f7f3]">
        {feed.filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted">No activity yet. Events appear only when an operation runs.</p>
        ) : (
          <div style={{ paddingTop: topPad, paddingBottom: bottomPad }}>
            {slice.map((event) => {
              const key = event.requestId ?? event.buildId
              const linked = key ? related.get(key) ?? 1 : 1
              const open = expanded === event.id
              return (
                <article key={event.id} className="border-b border-line px-3 py-2 text-sm" style={{ minHeight: ROW_ESTIMATE }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <span className="font-medium">{event.title}</span>{' '}
                      <span className="text-xs uppercase text-muted">{event.channel}</span>
                      {event.status ? (
                        <span className="text-xs text-muted">
                          {' '}
                          · {event.status === 'timeout' ? 'timed out (not cancelled)' : event.status}
                        </span>
                      ) : null}
                    </p>
                    <time className="text-xs text-muted" dateTime={event.timestamp}>
                      {event.timestamp}
                    </time>
                  </div>
                  {key ? (
                    <p className="text-xs text-muted">
                      {event.requestId ? `request ${event.requestId}` : null}
                      {event.requestId && event.buildId ? ' · ' : null}
                      {event.buildId ? `build ${event.buildId}` : null}
                      {linked > 1 ? ` · ${linked} linked events` : null}
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button type="button" className="text-xs underline" onClick={() => setExpanded(open ? null : event.id)}>
                      {open ? 'Hide details' : 'Show details'}
                    </button>
                    <button type="button" className="text-xs underline" onClick={() => copyText(eventCopy(event))}>
                      Copy event
                    </button>
                  </div>
                  {open ? (
                    <div className="mt-2 space-y-1 bg-white p-2 text-xs">
                      {event.model ? <p>Model: {event.model}</p> : null}
                      {event.settings ? (
                        <p>
                          Settings: num_predict={event.settings.numPredict} num_ctx={event.settings.numCtx} temp=
                          {event.settings.temperature} timeout={event.settings.timeoutMs}ms
                          {event.settings.format ? ` format=${event.settings.format}` : ''}
                        </p>
                      ) : null}
                      {event.messages?.map((message, index) => (
                        <pre key={`${event.id}-m-${index}`} className="whitespace-pre-wrap">
                          {message.role}: {message.content}
                          {message.truncated ? '\n…[truncated]' : ''}
                        </pre>
                      ))}
                      {event.output ? (
                        <pre className="whitespace-pre-wrap">
                          {event.output}
                          {event.outputTruncated ? '\n…[truncated]' : ''}
                        </pre>
                      ) : null}
                      {event.path ? <p>Path: {event.path}</p> : null}
                      {event.diff ? <pre className="whitespace-pre-wrap">{event.diff}</pre> : null}
                      {event.command ? (
                        <p>
                          Command: {event.command} {(event.args ?? []).join(' ')}
                          {event.cwd ? ` · cwd ${event.cwd}` : ''}
                          {event.exitCode !== undefined ? ` · exit ${event.exitCode}` : ''}
                          {event.cancelled ? ' · cancelled' : ''}
                        </p>
                      ) : null}
                      {event.detail ? <p>{event.detail}</p> : null}
                      {event.error ? <p className="text-[#8a1f1f]">{event.error}</p> : null}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
