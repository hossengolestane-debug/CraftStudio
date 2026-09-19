import type { ProjectSpec } from './spec'

export const SPEC_HISTORY_CAP = 20

export class SpecHistoryStack {
  current: ProjectSpec | null
  private past: ProjectSpec[] = []
  private future: ProjectSpec[] = []

  constructor(initial: ProjectSpec | null = null) {
    this.current = initial
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  set(next: ProjectSpec): void {
    if (this.current) {
      this.past = [...this.past.slice(-(SPEC_HISTORY_CAP - 1)), this.current]
    }
    this.future = []
    this.current = next
  }

  replace(next: ProjectSpec | null): void {
    this.past = []
    this.future = []
    this.current = next
  }

  undo(): ProjectSpec | null {
    const last = this.past.pop()
    if (!last || !this.current) {
      return this.current
    }
    this.future.push(this.current)
    this.current = last
    return this.current
  }

  redo(): ProjectSpec | null {
    const next = this.future.pop()
    if (!next || !this.current) {
      return this.current
    }
    this.past.push(this.current)
    this.current = next
    return this.current
  }
}
