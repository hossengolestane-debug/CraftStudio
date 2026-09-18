import { spawn } from 'node:child_process'
import { chmod } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../../shared/errors'
import { assertInsideRoot } from './pathSafety'

export interface BuildLogEvent {
  stream: 'stdout' | 'stderr'
  text: string
}

export interface BuildResult {
  started: boolean
  exitCode: number | null
  timedOut: boolean
  cancelled: boolean
  command: string
  logs: string
  message: string
}

const TRUSTED_ARGS = ['build', '--no-daemon', '--stacktrace'] as const

export class GradleService {
  private child: ReturnType<typeof spawn> | null = null

  cancel(): void {
    this.child?.kill('SIGTERM')
    this.child = null
  }

  async build(
    projectPath: string,
    options: {
      timeoutMs?: number
      onLog?: (event: BuildLogEvent) => void
    } = {}
  ): Promise<BuildResult> {
    assertInsideRoot(projectPath, projectPath)
    const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000
    const script = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
    const scriptPath = path.join(projectPath, script)
    assertInsideRoot(projectPath, scriptPath)

    if (process.platform !== 'win32') {
      try {
        await chmod(scriptPath, 0o755)
      } catch {
        // chmod best-effort
      }
    }

    const command = `${script} ${TRUSTED_ARGS.join(' ')}`
    const chunks: string[] = []

    return await new Promise((resolve) => {
      let settled = false
      const finish = (result: BuildResult): void => {
        if (settled) {
          return
        }
        settled = true
        this.child = null
        resolve(result)
      }

      const child = spawn(scriptPath, [...TRUSTED_ARGS], {
        cwd: projectPath,
        env: {
          PATH: process.env.PATH,
          JAVA_HOME: process.env.JAVA_HOME,
          HOME: process.env.HOME,
          GRADLE_USER_HOME: process.env.GRADLE_USER_HOME
        },
        windowsHide: true
      })
      this.child = child

      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        finish({
          started: true,
          exitCode: null,
          timedOut: true,
          cancelled: false,
          command,
          logs: chunks.join(''),
          message: `Gradle timed out after ${timeoutMs}ms. The project files may still be valid.`
        })
      }, timeoutMs)

      const push = (stream: 'stdout' | 'stderr', buf: Buffer): void => {
        const text = buf.toString('utf8')
        chunks.push(text)
        options.onLog?.({ stream, text })
      }

      child.stdout?.on('data', (buf: Buffer) => push('stdout', buf))
      child.stderr?.on('data', (buf: Buffer) => push('stderr', buf))
      child.on('error', (error) => {
        clearTimeout(timer)
        finish({
          started: false,
          exitCode: null,
          timedOut: false,
          cancelled: false,
          command,
          logs: chunks.join(''),
          message: `Could not start Gradle: ${error.message}`
        })
      })
      child.on('close', (code, signal) => {
        clearTimeout(timer)
        if (signal === 'SIGTERM' && !settled) {
          finish({
            started: true,
            exitCode: code,
            timedOut: false,
            cancelled: true,
            command,
            logs: chunks.join(''),
            message: 'Gradle build was cancelled.'
          })
          return
        }
        finish({
          started: true,
          exitCode: code,
          timedOut: false,
          cancelled: false,
          command,
          logs: chunks.join(''),
          message:
            code === 0
              ? 'Gradle build succeeded.'
              : `Gradle exited with code ${code ?? 'unknown'}. This is a real failure, not a simulated one.`
        })
      })
    })
  }
}

export function assertTrustedBuildCommand(args: string[]): void {
  if (args.length !== TRUSTED_ARGS.length || TRUSTED_ARGS.some((arg, index) => args[index] !== arg)) {
    throw new AppError({
      code: 'BUILD_GATED',
      message: 'Refusing to run a non-allowlisted Gradle command.',
      action: 'Phase 2 only runs `gradlew build --no-daemon --stacktrace`.',
      details: args.join(' ')
    })
  }
}
