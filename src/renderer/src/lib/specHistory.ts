import { useCallback, useRef, useState } from 'react'
import type { ProjectSpec } from '../../../shared/spec'

const HISTORY_CAP = 20

export function useSpecHistory(initial: ProjectSpec | null): {
  current: ProjectSpec | null
  setCurrent: (next: ProjectSpec) => void
  replaceCurrent: (next: ProjectSpec | null) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
} {
  const [current, setCurrentState] = useState<ProjectSpec | null>(initial)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const past = useRef<ProjectSpec[]>([])
  const future = useRef<ProjectSpec[]>([])

  const refreshFlags = (): void => {
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }

  const setCurrent = useCallback((next: ProjectSpec): void => {
    setCurrentState((prev) => {
      if (prev) {
        past.current = [...past.current.slice(-(HISTORY_CAP - 1)), prev]
      }
      future.current = []
      return next
    })
    queueMicrotask(refreshFlags)
  }, [])

  const replaceCurrent = useCallback((next: ProjectSpec | null): void => {
    past.current = []
    future.current = []
    setCurrentState(next)
    refreshFlags()
  }, [])

  const undo = useCallback((): void => {
    setCurrentState((prev) => {
      const last = past.current.pop()
      if (!last || !prev) {
        return prev
      }
      future.current.push(prev)
      return last
    })
    queueMicrotask(refreshFlags)
  }, [])

  const redo = useCallback((): void => {
    setCurrentState((prev) => {
      const next = future.current.pop()
      if (!next || !prev) {
        return prev
      }
      past.current.push(prev)
      return next
    })
    queueMicrotask(refreshFlags)
  }, [])

  return { current, setCurrent, replaceCurrent, undo, redo, canUndo, canRedo }
}
