import { useCallback, useRef, useState } from 'react'
import { SpecHistoryStack } from '../../../shared/specHistoryStack'
import type { ProjectSpec } from '../../../shared/spec'

export function useSpecHistory(initial: ProjectSpec | null): {
  current: ProjectSpec | null
  setCurrent: (next: ProjectSpec) => void
  replaceCurrent: (next: ProjectSpec | null) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
} {
  const stack = useRef(new SpecHistoryStack(initial))
  const [current, setCurrentState] = useState<ProjectSpec | null>(stack.current.current)
  const [canUndo, setCanUndo] = useState(stack.current.canUndo)
  const [canRedo, setCanRedo] = useState(stack.current.canRedo)

  const refresh = (): void => {
    setCurrentState(stack.current.current)
    setCanUndo(stack.current.canUndo)
    setCanRedo(stack.current.canRedo)
  }

  const setCurrent = useCallback((next: ProjectSpec): void => {
    stack.current.set(next)
    refresh()
  }, [])

  const replaceCurrent = useCallback((next: ProjectSpec | null): void => {
    stack.current.replace(next)
    refresh()
  }, [])

  const undo = useCallback((): void => {
    stack.current.undo()
    refresh()
  }, [])

  const redo = useCallback((): void => {
    stack.current.redo()
    refresh()
  }, [])

  return { current, setCurrent, replaceCurrent, undo, redo, canUndo, canRedo }
}
