import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface JavaStatus {
  available: boolean
  version: number | null
  raw: string
  meets: boolean
  required: number
  message: string
}

export async function checkJava(required: number): Promise<JavaStatus> {
  try {
    const { stderr, stdout } = await execFileAsync('java', ['-version'], { timeout: 8000 })
    const raw = `${stderr}\n${stdout}`
    const match = raw.match(/version "(\d+)/)
    const version = match ? Number(match[1]) : null
    const meets = version !== null && version >= required
    return {
      available: true,
      version,
      raw: raw.trim(),
      meets,
      required,
      message: meets
        ? `Java ${version} meets the required toolchain (${required}+).`
        : `Java ${version ?? 'unknown'} is installed, but this project needs Java ${required}+.`
    }
  } catch (error) {
    return {
      available: false,
      version: null,
      raw: error instanceof Error ? error.message : String(error),
      meets: false,
      required,
      message: `Java was not found. Install JDK ${required} and ensure \`java\` is on PATH.`
    }
  }
}
