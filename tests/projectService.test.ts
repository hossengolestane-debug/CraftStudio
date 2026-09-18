import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectService } from '../src/main/services/projectService'
import { SettingsService } from '../src/main/services/settingsService'
import { MANIFEST_FILENAME } from '../src/shared/types'
import { parseManifestJson } from '../src/shared/manifest'

async function makeService() {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'cs-settings-'))
  const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'cs-projects-'))
  const settings = new SettingsService({ userDataPath: userData })
  await settings.update({ projectsPath: projectsRoot })
  const service = new ProjectService(settings, () => new Date('2026-09-18T12:00:00.000Z'))
  return { service, settings, userData, projectsRoot }
}

describe('project service', () => {
  const temps: string[] = []

  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('creates a project, writes a manifest, and lists it back', async () => {
    const ctx = await makeService()
    temps.push(ctx.userData, ctx.projectsRoot)

    const created = await ctx.service.create({
      name: 'River Stones',
      description: 'Adds polished river stones.',
      type: 'mod',
      platform: 'fabric',
      minecraftVersion: '1.21.1',
      features: { customItems: true }
    })

    const raw = await readFile(path.join(created.directoryPath, MANIFEST_FILENAME), 'utf8')
    const fromDisk = parseManifestJson(raw)
    expect(fromDisk.name).toBe('River Stones')
    expect(fromDisk.platform).toBe('fabric')
    expect(fromDisk.features.customItems).toBe(true)
    expect(fromDisk.schemaVersion).toBe(1)

    const snapshot = await readFile(
      path.join(created.directoryPath, 'snapshots', 'created.manifest.json'),
      'utf8'
    )
    expect(parseManifestJson(snapshot).id).toBe(created.manifest.id)

    const listed = await ctx.service.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(created.manifest.id)

    const opened = await ctx.service.open(created.manifest.id)
    expect(opened.manifest.name).toBe('River Stones')
    expect((await ctx.settings.get()).lastOpenedProjectId).toBe(created.manifest.id)
  })

  it('renames metadata and deletes the folder', async () => {
    const ctx = await makeService()
    temps.push(ctx.userData, ctx.projectsRoot)
    const created = await ctx.service.create({
      name: 'Old Name',
      description: '',
      type: 'plugin',
      platform: 'paper',
      minecraftVersion: '1.21.1'
    })

    const renamed = await ctx.service.update(created.manifest.id, { name: 'New Name' })
    expect(renamed.manifest.name).toBe('New Name')
    expect(renamed.manifest.updatedAt).toBe('2026-09-18T12:00:00.000Z')

    await ctx.service.delete(created.manifest.id)
    expect(await ctx.service.list()).toEqual([])
  })

  it('refuses an unsupported platform/version pair', async () => {
    const ctx = await makeService()
    temps.push(ctx.userData, ctx.projectsRoot)
    await expect(
      ctx.service.create({
        name: 'Too Old',
        description: '',
        type: 'mod',
        platform: 'neoforge',
        minecraftVersion: '1.20.1'
      })
    ).rejects.toThrow(/unsupported/)
  })
})
