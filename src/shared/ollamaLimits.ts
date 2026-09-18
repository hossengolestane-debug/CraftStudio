export const OLLAMA_CHECK_TIMEOUT_CAP_MS = 5000
export const OLLAMA_STREAM_CONTENT_CAP = 262144
export const OLLAMA_TEST_NUM_PREDICT = 8
export const OLLAMA_TEST_NUM_CTX = 512
export const OLLAMA_TEST_TIMEOUT_MS = 20000
export const OLLAMA_PROGRESS_BATCH_MS = 80
export const OLLAMA_PROMPT_USER_CAP = 1200
export const OLLAMA_REPAIR_ASSISTANT_CAP = 8000
export const ACTIVITY_MEMORY_CAP = 400
export const BUILD_LOG_MEMORY_CAP = 200_000
export const DISPLAY_LOG_CAP = 80_000
export const ACTIVITY_FLUSH_MS = 80

export function isResourceExhaustionMessage(text: string): boolean {
  return /out of memory|resource exhausted|not enough memory|cuda.?oom|vram|cannot allocate|status code 5\d\d/i.test(
    text
  )
}

export function compactTemplateHint(input: {
  items: { id: string }[]
  blocks: { id: string }[]
  mobs: { id: string }[]
  worldgen: { id: string }[]
}): string {
  const parts = [
    input.items.length ? `items=${input.items.map((item) => item.id).slice(0, 8).join(',')}` : '',
    input.blocks.length ? `blocks=${input.blocks.map((block) => block.id).slice(0, 4).join(',')}` : '',
    input.mobs.length ? `mobs=${input.mobs.map((mob) => mob.id).slice(0, 4).join(',')}` : '',
    input.worldgen.length ? `worldgen=${input.worldgen.map((entry) => entry.id).slice(0, 4).join(',')}` : ''
  ].filter(Boolean)
  return parts.join('; ') || 'empty-template'
}
