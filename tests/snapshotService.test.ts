import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GenerationService } from '../src/main/services/generationService'
import { OllamaService } from '../src/main/services/ollamaService'
import { ProjectService } from '../src/main/services/projectService'
import { SettingsService } from '../src/main/services/settingsService'
import {
  createProjectSnapshot,
  listProjectSnapshots,
  restoreProjectSnapshot
} from '../src/main/services/snapshotService'

describe('project snapshots', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('restores files from a before-apply snapshot', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cs-snap-'))
    temps.push(root)
    const dir = 'demo-project'
    await mkdir(path.join(root, dir), { recursive: true })
    await writeFile(path.join(root, dir, 'README.md'), 'original\n', 'utf8')
    const created = await createProjectSnapshot(root, dir, 'before-apply', {
      platform: 'fabric',
      minecraftVersion: '1.21.1'
    })
    expect(created.fileCount).toBeGreaterThan(0)
    await writeFile(path.join(root, dir, 'README.md'), 'changed\n', 'utf8')
    await restoreProjectSnapshot(root, dir, created.id)
    expect(await readFile(path.join(root, dir, 'README.md'), 'utf8')).toBe('original\n')
    const listed = await listProjectSnapshots(root, dir)
    expect(listed[0]?.reason).toBe('before-apply')
  })

  it('snapshots before apply and before a version change', async () => {
    const userData = await mkdtemp(path.join(os.tmpdir(), 'cs-snap-settings-'))
    const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'cs-snap-projects-'))
    temps.push(userData, projectsRoot)
    const settings = new SettingsService({ userDataPath: userData })
    await settings.update({ projectsPath: projectsRoot })
    const projects = new ProjectService(settings, () => new Date('2026-09-18T16:00:00.000Z'))
    const generation = new GenerationService(projects, settings, new OllamaService())
    const created = await projects.create({
      name: 'River Stones',
      description: 'Add an item called river stone',
      type: 'mod',
      platform: 'fabric',
      minecraftVersion: '1.21.1'
    })
    const result = await generation.generateSpec(created.manifest.id, created.manifest.description, 'template')
    const applied = await generation.applySpec(created.manifest.id, result.spec, true)
    expect(applied.applied).toBe(true)
    const afterApply = await listProjectSnapshots(projectsRoot, created.directoryName)
    expect(afterApply.some((item) => item.reason === 'before-apply')).toBe(true)

    const blocked = await projects.assessMinecraftVersion(created.manifest.id, '1.18.2')
    expect(blocked.canApply).toBe(false)
    await expect(projects.update(created.manifest.id, { minecraftVersion: '1.18.2' })).rejects.toThrow(/Cannot change/)

    const updated = await projects.update(created.manifest.id, { minecraftVersion: '1.21.4' })
    expect(updated.manifest.minecraftVersion).toBe('1.21.4')
    const afterVersion = await listProjectSnapshots(projectsRoot, created.directoryName)
    expect(afterVersion.some((item) => item.reason === 'before-version-change')).toBe(true)
  })
})
