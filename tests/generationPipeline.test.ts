import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GenerationService } from '../src/main/services/generationService'
import { OllamaService } from '../src/main/services/ollamaService'
import { ProjectService } from '../src/main/services/projectService'
import { SettingsService } from '../src/main/services/settingsService'
import { SPEC_FILENAME } from '../src/shared/types'

describe('generation pipeline', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('creates a Fabric project, infers a spec, and writes real Gradle files', async () => {
    const userData = await mkdtemp(path.join(os.tmpdir(), 'cs-gen-settings-'))
    const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'cs-gen-projects-'))
    temps.push(userData, projectsRoot)
    const settings = new SettingsService({ userDataPath: userData })
    await settings.update({ projectsPath: projectsRoot })
    const projects = new ProjectService(settings, () => new Date('2026-09-18T15:00:00.000Z'))
    const generation = new GenerationService(projects, settings, new OllamaService())

    const created = await projects.create({
      name: 'River Stones',
      description: 'Adds an item called polished pebble and a recipe',
      type: 'mod',
      platform: 'fabric',
      minecraftVersion: '1.21.1'
    })

    const result = await generation.generateSpec(
      created.manifest.id,
      created.manifest.description,
      'template'
    )
    expect(result.usedOllama).toBe(false)
    expect(result.spec.items.length).toBeGreaterThan(0)

    const applied = await generation.applySpec(created.manifest.id, result.spec, true)
    expect(applied.applied).toBe(true)
    expect(applied.changes.some((change) => change.relativePath === 'build.gradle')).toBe(true)

    const specOnDisk = await readFile(path.join(created.directoryPath, SPEC_FILENAME), 'utf8')
    expect(specOnDisk).toContain('"schemaVersion": 1')
    const java = await readFile(
      path.join(created.directoryPath, 'src/main/java/local/craftstudio/river_stones/RiverStones.java'),
      'utf8'
    )
    expect(java).toContain('implements ModInitializer')
    const listed = await projects.list()
    expect(listed[0]?.id).toBe(created.manifest.id)
  })
})
