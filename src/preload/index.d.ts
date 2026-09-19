import type { CraftStudioAPI } from '../shared/ipc'

declare global {
  interface Window {
    craftstudio: CraftStudioAPI
  }
}

export {}
