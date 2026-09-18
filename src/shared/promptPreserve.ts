/** Stored request is never mid-word sliced. Model input may be bounded for local VRAM. */

export const STORED_PROMPT_MAX = 32_000
export const MODEL_PROMPT_SOFT_CAP = 4_000

export function preservePrompt(text: string): string {
  if (text.length <= STORED_PROMPT_MAX) {
    return text
  }
  return truncateAtWord(text, STORED_PROMPT_MAX)
}

export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }
  const slice = text.slice(0, max)
  const breakAt = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'), slice.lastIndexOf('\t'))
  const cut = breakAt >= Math.floor(max * 0.6) ? slice.slice(0, breakAt) : slice
  return `${cut.replace(/[ \t]+$/u, '')}…`
}

export function shortSummary(text: string, max = 400): string {
  const trimmed = text.trim()
  if (!trimmed) {
    return ''
  }
  const sentence = trimmed.split(/(?<=[.!?])\s/u)[0] ?? trimmed
  return sentence.length <= max ? sentence : truncateAtWord(sentence, max)
}

export function modelPromptExcerpt(fullPrompt: string, cap = MODEL_PROMPT_SOFT_CAP): {
  excerpt: string
  truncated: boolean
} {
  if (fullPrompt.length <= cap) {
    return { excerpt: fullPrompt, truncated: false }
  }
  return {
    excerpt: `${truncateAtWord(fullPrompt, cap)}\n\n[Full original request is stored untruncated in spec.prompt; this excerpt is model-input only.]`,
    truncated: true
  }
}
