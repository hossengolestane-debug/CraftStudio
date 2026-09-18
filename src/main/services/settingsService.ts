import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AppError, toAppError } from '../../shared/errors'
import {
  DEFAULT_OLLAMA_ENDPOINT,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  SETTINGS_SCHEMA_VERSION,
  type AppSettings,
  type SettingsPatch
} from '../../shared/types'

export interface SettingsPaths {
  userDataPath: string
  homeDir?: string
}

export function getDefaultProjectsPath(userDataPath: string): string {
  return path.join(userDataPath, 'CraftStudioProjects')
}

export function getHomeProjectsPath(homeDir = os.homedir()): string {
  return path.join(homeDir, 'CraftStudioProjects')
}

export function settingsFilePath(userDataPath: string): string {
  return path.join(userDataPath, 'settings.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateSettings(value: unknown, fallbackProjectsPath: string): AppSettings {
  if (!isRecord(value)) {
    throw new AppError({
      code: 'SETTINGS_INVALID',
      message: 'Settings file is not a JSON object.',
      action: 'Reset settings from the Settings page or delete settings.json in the app userData folder.'
    })
  }

  const projectsPath =
    typeof value.projectsPath === 'string' && value.projectsPath.trim().length > 0
      ? path.resolve(value.projectsPath)
      : fallbackProjectsPath

  const ollamaEndpoint =
    typeof value.ollamaEndpoint === 'string' && value.ollamaEndpoint.trim().length > 0
      ? value.ollamaEndpoint.trim()
      : DEFAULT_OLLAMA_ENDPOINT

  try {
    const parsed = new URL(ollamaEndpoint)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Ollama endpoint must be http or https.')
    }
  } catch (error) {
    throw new AppError({
      code: 'SETTINGS_INVALID',
      message: 'Ollama endpoint is not a valid http(s) URL.',
      action: 'Enter a local URL such as http://localhost:11434.',
      details: error instanceof Error ? error.message : String(error)
    })
  }

  const timeoutRaw = value.ollamaTimeoutMs
  const ollamaTimeoutMs =
    typeof timeoutRaw === 'number' && Number.isFinite(timeoutRaw) && timeoutRaw >= 1000 && timeoutRaw <= 60000
      ? Math.round(timeoutRaw)
      : DEFAULT_OLLAMA_TIMEOUT_MS

  const lastOpenedProjectId =
    value.lastOpenedProjectId === null || value.lastOpenedProjectId === undefined
      ? null
      : typeof value.lastOpenedProjectId === 'string'
        ? value.lastOpenedProjectId
        : null

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    projectsPath,
    ollamaEndpoint,
    ollamaTimeoutMs,
    lastOpenedProjectId
  }
}

export class SettingsService {
  private cache: AppSettings | null = null

  constructor(private readonly paths: SettingsPaths) {}

  defaultProjectsPath(): string {
    return getDefaultProjectsPath(this.paths.userDataPath)
  }

  homeProjectsPath(): string {
    return getHomeProjectsPath(this.paths.homeDir)
  }

  async get(): Promise<AppSettings> {
    if (this.cache) {
      return this.cache
    }

    const file = settingsFilePath(this.paths.userDataPath)
    const fallback = this.defaultProjectsPath()

    try {
      const raw = await readFile(file, 'utf8')
      this.cache = validateSettings(JSON.parse(raw), fallback)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.cache = validateSettings({}, fallback)
        await this.persist(this.cache)
      } else if (error instanceof AppError) {
        throw error
      } else if (error instanceof SyntaxError) {
        throw new AppError({
          code: 'SETTINGS_INVALID',
          message: 'Settings JSON is malformed.',
          action: 'Fix or delete settings.json in the app userData folder, then reopen Settings.',
          details: error.message
        })
      } else {
        throw toAppError(error, {
          code: 'IO',
          message: 'Could not read settings.',
          action: 'Check that the app userData folder is writable.'
        })
      }
    }

    return this.cache
  }

  async update(patch: SettingsPatch): Promise<AppSettings> {
    const current = await this.get()
    const next = validateSettings(
      {
        ...current,
        ...patch
      },
      this.defaultProjectsPath()
    )
    await this.persist(next)
    this.cache = next
    return next
  }

  private async persist(settings: AppSettings): Promise<void> {
    const file = settingsFilePath(this.paths.userDataPath)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  }
}
