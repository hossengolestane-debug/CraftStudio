import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActivityChannel, ActivityEvent } from '../../../shared/activity'
import { ACTIVITY_MEMORY_CAP } from '../../../shared/ollamaLimits'

const api = window.craftstudio

export type ActivityFilter = 'all' | ActivityChannel

export function useActivityFeed(enabled: boolean): {
  events: ActivityEvent[]
  paused: boolean
  setPaused: (value: boolean) => void
  filter: ActivityFilter
  setFilter: (value: ActivityFilter) => void
  follow: boolean
  setFollow: (value: boolean) => void
  filtered: ActivityEvent[]
  refresh: () => Promise<void>
  clearView: () => Promise<void>
} {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [follow, setFollow] = useState(true)
  const pausedRef = useRef(false)
  const bufferRef = useRef<ActivityEvent[]>([])

  useEffect(() => {
    pausedRef.current = paused
    if (!paused && bufferRef.current.length > 0) {
      const extra = bufferRef.current
      bufferRef.current = []
      setEvents((current) => [...current, ...extra].slice(-ACTIVITY_MEMORY_CAP))
    }
  }, [paused])

  const refresh = useCallback(async () => {
    const list = await api.listActivity()
    setEvents(list.slice(-ACTIVITY_MEMORY_CAP))
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }
    void refresh().catch(() => undefined)
    const off = api.onActivity((event) => {
      if (pausedRef.current) {
        bufferRef.current.push(event)
        if (bufferRef.current.length > ACTIVITY_MEMORY_CAP) {
          bufferRef.current.splice(0, bufferRef.current.length - ACTIVITY_MEMORY_CAP)
        }
        return
      }
      setEvents((current) => {
        const last = current[current.length - 1]
        if (
          event.status === 'streaming' &&
          last &&
          last.status === 'streaming' &&
          last.requestId &&
          last.requestId === event.requestId
        ) {
          return [...current.slice(0, -1), event]
        }
        return [...current, event].slice(-ACTIVITY_MEMORY_CAP)
      })
    })
    return () => {
      off()
      bufferRef.current = []
    }
  }, [enabled, refresh])

  const filtered =
    filter === 'all'
      ? events
      : filter === 'errors'
        ? events.filter((event) => event.channel === 'errors' || event.status === 'failure')
        : events.filter((event) => event.channel === filter)

  const clearView = useCallback(async () => {
    await api.clearActivity()
    bufferRef.current = []
    setEvents([])
  }, [])

  return {
    events,
    paused,
    setPaused,
    filter,
    setFilter,
    follow,
    setFollow,
    filtered,
    refresh,
    clearView
  }
}
