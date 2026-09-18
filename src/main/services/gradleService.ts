import { spawn } from 'node:child_process'
import { chmod } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../../shared/errors'
import { assertInsideRoot } from './pathSafety'

export type GradleTaskId = 'build' | 'runClient'

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
  task: GradleTaskId
  logs: string
  message: string
  compileOnly: boolean
}

const TRUSTED_TASKS: Record<GradleTaskId, readonly string[]> = {
  build: ['build', '--no-daemon', '--stacktrace'],
  runClient: ['runClient', '--no-daemon', '--stacktrace']
}

export class GradleService {
  private child: ReturnType<typeof spawn> | null = null
  private readonly lastByProject = new Map<string, BuildResult>()

  lastResult(projectPath: string): BuildResult | undefined {
    return this.lastByProject.get(path.resolve(projectPath))
  }

  cancel(): void {
    this.child?.kill('SIGTERM')
    this.child = null
  }

  async run(
    projectPath: string,
    task: GradleTaskId,
    options: {
      timeoutMs?: number
      onLog?: (event: BuildLogEvent) => void
    } = {}
  ): Promise<BuildResult> {
    const args = TRUSTED_TASKS[task]
    if (!args) {
      throw new AppError({
        code: 'BUILD_GATED',
        message: 'Refusing an unknown Gradle task.',
        action: 'Only allowlisted `build` or `runClient` may run.'
      })
    }
    assertTrustedGradleArgs([...args])
    assertInsideRoot(projectPath, projectPath)
    const timeoutMs = options.timeoutMs ?? (task === 'runClient' ? 20 * 60 * 1000 : 10 * 60 * 1000)
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

    const command = `${script} ${args.join(' ')}`
    const chunks: string[] = []

    return await new Promise((resolve) => {
      let settled = false
      const finish = (result: BuildResult): void => {
        if (settled) {
          return
        }
        settled = true
        this.child = null
        this.lastByProject.set(path.resolve(projectPath), result)
        resolve(result)
      }

      const child = spawn(scriptPath, [...args], {
        cwd: projectPath,
        env: {
          PATH: process.env.PATH,
          JAVA_HOME: process.env.JAVA_HOME,
          HOME: process.env.HOME,
          DISPLAY: process.env.DISPLAY,
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
          task,
          logs: chunks.join(''),
          compileOnly: task === 'build',
          message: `Gradle ${task} timed out after ${timeoutMs}ms. This is not treated as success.`
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
          task,
          logs: chunks.join(''),
          compileOnly: task === 'build',
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
            task,
            logs: chunks.join(''),
            compileOnly: task === 'build',
            message: `Gradle ${task} was cancelled.`
          })
          return
        }
        const ok = code === 0
        finish({
          started: true,
          exitCode: code,
          timedOut: false,
          cancelled: false,
          command,
          task,
          logs: chunks.join(''),
          compileOnly: task === 'build',
          message: ok
            ? task === 'build'
              ? 'Gradle build succeeded (compile). Compatibility is still Experimental until a real Minecraft runtime is verified.'
              : 'Gradle runClient exited 0. This is compile/runtime launch evidence only after you record it on the Test tab — not an automatic Tested badge.'
            : `Gradle ${task} exited with code ${code ?? 'unknown'}. This is a real failure, not a simulated one.`
        })
      })
    })
  }

  build(
    projectPath: string,
    options: {
      timeoutMs?: number
      onLog?: (event: BuildLogEvent) => void
    } = {}
  ): Promise<BuildResult> {
    return this.run(projectPath, 'build', options)
  }
}

export function assertTrustedGradleArgs(args: string[]): void {
  const allowed = Object.values(TRUSTED_TASKS)
  const ok = allowed.some((trusted) => trusted.length === args.length && trusted.every((arg, i) => args[i] === arg))
  if (!ok) {
    throw new AppError({
      code: 'BUILD_GATED',
      message: 'Refusing to run a non-allowlisted Gradle command.',
      action: 'Only `gradlew build|runClient --no-daemon --stacktrace` is allowlisted.',
      details: args.join(' ')
    })
  }
}

export const assertTrustedBuildCommand = assertTrustedGradleArgs
