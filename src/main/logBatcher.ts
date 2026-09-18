export function createTextBatcher(
  flush: (text: string) => void,
  intervalMs: number
): { push: (text: string) => void; dispose: () => void } {
  let pending = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  const send = (): void => {
    if (!pending) {
      return
    }
    const text = pending
    pending = ''
    flush(text)
  }
  return {
    push(text: string): void {
      pending += text
      if (!timer) {
        timer = setTimeout(() => {
          timer = null
          send()
        }, intervalMs)
      }
    },
    dispose(): void {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      send()
    }
  }
}
