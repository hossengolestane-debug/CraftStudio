import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { AppError, toAppError } from '../../shared/errors'
import { parseManifestJson, validateManifest } from '../../shared/manifest'
import { assertCreatableCombination } from '../../shared/compatibility'
import { getAdapter } from '../../shared/adapters/registry'
import { platformMatchesKind } from '../../shared/manifest'
import {
  EMPTY_FEATURES,
  MANIFEST_FILENAME,
  MANIFEST_SCHEMA_VERSION,
  type CreateProjectInput,
  type ProjectFeatures,
  type ProjectManifest,
  type ProjectRecord,
  type ProjectSummary,
  type UpdateProjectInput
} from '../../shared/types'
import { resolveContainedPath, resolveProjectsRoot, toProjectDirectoryName } from './pathSafety'
import type { SettingsService } from './settingsService'

function nowIso(clock: () => Date): string {
  return clock().toISOString()
}

function mergeFeatures(partial?: Partial<ProjectFeatures>): ProjectFeatures {
  return { ...EMPTY_FEATURES, ...partial }
}

export class ProjectService {
  constructor(
    private readonly settings: SettingsService,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async list(): Promise<ProjectSummary[]> {
    const root = await this.root()
    await mkdir(root, { recursive: true })
    const entries = await readdir(root, { withFileTypes: true })
    const projects: ProjectSummary[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      try {
        const record = await this.readFromDirectory(entry.name)
        projects.push({
          id: record.manifest.id,
          name: record.manifest.name,
          description: record.manifest.description,
          type: record.manifest.type,
          platform: record.manifest.platform,
          minecraftVersion: record.manifest.minecraftVersion,
          updatedAt: record.manifest.updatedAt,
          directoryName: record.directoryName
        })
      } catch {
        // Skip folders that are not valid CraftStudio projects.
      }
    }

    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    const name = input.name.trim()
    if (name.length < 1 || name.length > 80) {
      throw new AppError({
        code: 'VALIDATION',
        message: 'Project name must be 1–80 characters.',
        action: 'Enter a shorter, clearer project name.'
      })
    }

    if (!platformMatchesKind(input.platform, input.type)) {
      throw new AppError({
        code: 'VALIDATION',
        message: `Cannot create a ${input.type} on ${input.platform}.`,
        action: 'Mods use Fabric, NeoForge, or Forge. Plugins use Paper or Spigot.'
      })
    }

    getAdapter(input.platform)
    assertCreatableCombination(input.platform, input.minecraftVersion)

    const root = await this.root()
    await mkdir(root, { recursive: true })

    const id = randomUUID()
    const createdAt = nowIso(this.clock)
    const manifest = validateManifest({
      id,
      name,
      description: input.description.trim(),
      type: input.type,
      platform: input.platform,
      minecraftVersion: input.minecraftVersion,
      createdAt,
      updatedAt: createdAt,
      features: mergeFeatures(input.features),
      schemaVersion: MANIFEST_SCHEMA_VERSION
    })

    const directoryName = toProjectDirectoryName(name, id)
    const directoryPath = resolveContainedPath(root, directoryName)

    try {
      await mkdir(directoryPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new AppError({
          code: 'PROJECT_EXISTS',
          message: 'A project folder with that name already exists.',
          action: 'Choose a different project name.',
          details: directoryPath
        })
      }
      throw toAppError(error, {
        code: 'IO',
        message: 'Could not create the project folder.',
        action: 'Check that the projects root is writable.'
      })
    }

    await this.writeManifest(directoryPath, manifest)
    await mkdir(resolveContainedPath(root, directoryName, 'snapshots'), { recursive: true })
    await writeFile(
      resolveContainedPath(root, directoryName, 'snapshots', 'created.manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8'
    )
    await writeFile(
      resolveContainedPath(root, directoryName, 'README.md'),
      this.readmeFor(manifest),
      'utf8'
    )

    return { manifest, directoryName, directoryPath }
  }

  async get(id: string): Promise<ProjectRecord> {
    const match = (await this.listRecords()).find((record) => record.manifest.id === id)
    if (!match) {
      throw new AppError({
        code: 'PROJECT_NOT_FOUND',
        message: 'That project could not be found.',
        action: 'Refresh the Projects list or create the project again.',
        details: id
      })
    }
    return match
  }

  async open(id: string): Promise<ProjectRecord> {
    const record = await this.get(id)
    await this.settings.update({ lastOpenedProjectId: id })
    return record
  }

  async update(id: string, input: UpdateProjectInput): Promise<ProjectRecord> {
    const record = await this.get(id)
    const next = validateManifest({
      ...record.manifest,
      name: input.name?.trim() ?? record.manifest.name,
      description:
        input.description !== undefined ? input.description.trim() : record.manifest.description,
      features: input.features
        ? { ...record.manifest.features, ...input.features }
        : record.manifest.features,
      updatedAt: nowIso(this.clock)
    })

    await this.writeManifest(record.directoryPath, next)
    return {
      ...record,
      manifest: next
    }
  }

  async delete(id: string): Promise<void> {
    const record = await this.get(id)
    const root = await this.root()
    resolveContainedPath(root, record.directoryName)
    await rm(record.directoryPath, { recursive: true, force: false })

    const settings = await this.settings.get()
    if (settings.lastOpenedProjectId === id) {
      await this.settings.update({ lastOpenedProjectId: null })
    }
  }

  private async root(): Promise<string> {
    const settings = await this.settings.get()
    return resolveProjectsRoot(settings.projectsPath)
  }

  private async listRecords(): Promise<ProjectRecord[]> {
    const root = await this.root()
    await mkdir(root, { recursive: true })
    const entries = await readdir(root, { withFileTypes: true })
    const records: ProjectRecord[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      try {
        records.push(await this.readFromDirectory(entry.name))
      } catch {
        // ignore non-projects
      }
    }
    return records
  }

  private async readFromDirectory(directoryName: string): Promise<ProjectRecord> {
    const root = await this.root()
    const directoryPath = resolveContainedPath(root, directoryName)
    const info = await stat(directoryPath)
    if (!info.isDirectory()) {
      throw new Error('Not a directory')
    }
    const raw = await readFile(resolveContainedPath(root, directoryName, MANIFEST_FILENAME), 'utf8')
    const manifest = parseManifestJson(raw)
    return { manifest, directoryName, directoryPath }
  }

  private async writeManifest(directoryPath: string, manifest: ProjectManifest): Promise<void> {
    const root = await this.root()
    const relative = path.relative(root, directoryPath)
    const first = relative.split(path.sep)[0]
    if (!first) {
      throw new AppError({
        code: 'PATH_ESCAPE',
        message: 'Refusing to write a manifest outside a project folder.',
        action: 'Keep projects under the configured projects root.'
      })
    }
    const target = resolveContainedPath(root, first, MANIFEST_FILENAME)
    await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  private readmeFor(manifest: ProjectManifest): string {
    return [
      `# ${manifest.name}`,
      '',
      manifest.description || '_No description yet._',
      '',
      `- Type: ${manifest.type}`,
      `- Platform: ${manifest.platform}`,
      `- Minecraft: ${manifest.minecraftVersion}`,
      `- Created: ${manifest.createdAt}`,
      '',
      'This folder was created by CraftStudio Local.',
      'A create-time snapshot of the manifest is stored in `snapshots/created.manifest.json`.',
      'Use Design → Generate to emit a Fabric Gradle project from a validated spec (Phase 2).',
      ''
    ].join('\n')
  }
}
