import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isEditableProjectPath, isTrustedOutputPath } from '../src/main/codegen/allowlist'
import { planForgeFiles } from '../src/main/codegen/forge/emitter'
import { GenerationService } from '../src/main/services/generationService'
import { OllamaService } from '../src/main/services/ollamaService'
import { ProjectService } from '../src/main/services/projectService'
import { SettingsService } from '../src/main/services/settingsService'
import { APP_VERSION } from '../src/shared/buildInfo'
import {
  formatSpecJson,
  generatorSupportNote,
  HAND_PAINTED_TEXTURE_PIPELINE,
  LEGENDARY_MACE_GENERATOR_SUPPORT,
  SPEC_EXPORT_FILENAME,
  specsMatch
} from '../src/shared/specInspector'
import { parseProjectSpec } from '../src/shared/spec'
import { MINIMAL_VALID_SPEC_EXAMPLE } from '../src/shared/specPrompt'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

describe('specification inspector helpers', () => {
  it('formats the complete draft JSON and detects editor changes', () => {
    const spec = parseProjectSpec(MINIMAL_VALID_SPEC_EXAMPLE)
    const json = formatSpecJson(spec)
    expect(json).toContain('"schemaVersion": 1')
    expect(json).toContain('"unsupportedRequests"')
    expect(json).toContain('copper_rod')
    const edited = { ...spec, items: spec.items.map((item) => ({ ...item, displayName: 'Edited Rod' })) }
    expect(specsMatch(spec, spec)).toBe(true)
    expect(specsMatch(spec, edited)).toBe(false)
  })

  it('keeps Legendary Mace generator rows honest', () => {
    expect(LEGENDARY_MACE_GENERATOR_SUPPORT.every((row) => row.status === 'DESCRIPTION/UNSUPPORTED ONLY')).toBe(true)
    expect(HAND_PAINTED_TEXTURE_PIPELINE.status).toBe('IMPLEMENTED')
    expect(generatorSupportNote(0)).toBeNull()
    expect(generatorSupportNote(1)).toMatch(/not the same as implemented/)
  })

  it('allows a path-confined specification.json export', () => {
    expect(SPEC_EXPORT_FILENAME).toBe('specification.json')
    expect(isTrustedOutputPath(SPEC_EXPORT_FILENAME)).toBe(true)
    expect(isEditableProjectPath(SPEC_EXPORT_FILENAME)).toBe(true)
    expect(isEditableProjectPath('../specification.json')).toBe(false)
  })
})

describe('specification export and applied status', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('exports the current draft and reports last-applied after Apply only', async () => {
    const userData = await mkdtemp(path.join(os.tmpdir(), 'cs-inspector-settings-'))
    const projectsRoot = await mkdtemp(path.join(os.tmpdir(), 'cs-inspector-projects-'))
    temps.push(userData, projectsRoot)
    const settings = new SettingsService({ userDataPath: userData })
    await settings.update({ projectsPath: projectsRoot })
    const projects = new ProjectService(settings, () => new Date('2026-09-18T17:00:00.000Z'))
    const generation = new GenerationService(projects, settings, new OllamaService())
    const created = await projects.create({
      name: 'Copper Rod',
      description: 'Add an item called copper rod',
      type: 'mod',
      platform: 'forge',
      minecraftVersion: '1.21.1'
    })

    const result = await generation.generateSpec(created.manifest.id, created.manifest.description, 'template')
    const beforeApply = await generation.getAppliedSpec(created.manifest.id)
    expect(beforeApply.spec).toBeNull()
    expect(beforeApply.appliedAt).toBeNull()

    const exported = await generation.exportSpecificationJson(created.manifest.id, result.spec)
    expect(exported.relativePath).toBe('specification.json')
    const copy = await readFile(path.join(created.directoryPath, SPEC_EXPORT_FILENAME), 'utf8')
    expect(copy).toContain(result.spec.items[0]!.id)
    expect(copy).not.toContain('…[truncated')

    const applied = await generation.applySpec(created.manifest.id, result.spec, true)
    expect(applied.applied).toBe(true)
    const afterApply = await generation.getAppliedSpec(created.manifest.id)
    expect(afterApply.spec?.items[0]?.id).toBe(result.spec.items[0]?.id)
    expect(afterApply.appliedAt).toMatch(/T/)
    expect(afterApply.relativePath).toBe('craftstudio.spec.json')
  })
})

describe('Forge generator does not implement Legendary Mace extras', () => {
  it('emits a generic item and records gaps without smash or life steal code', () => {
    const manifest: ProjectManifest = {
      id: 'bbbbbbbb-1111-4222-8333-444444444444',
      name: 'Legendary Mace',
      description: 'Legendary Mace',
      type: 'mod',
      platform: 'forge',
      minecraftVersion: '1.21.1',
      createdAt: '2026-09-18T08:00:00.000Z',
      updatedAt: '2026-09-18T08:00:00.000Z',
      features: {
        customItems: true,
        customMobs: false,
        customGuis: false,
        customBlocks: false,
        recipes: true
      },
      schemaVersion: MANIFEST_SCHEMA_VERSION
    }
    const spec = parseProjectSpec({
      ...MINIMAL_VALID_SPEC_EXAMPLE,
      modId: 'legendary_mace',
      displayName: 'Legendary Mace',
      packageName: 'local.craftstudio.legendary_mace',
      mainClass: 'LegendaryMace',
      items: [
        {
          id: 'legendary_mace',
          displayName: 'Legendary Mace',
          maxCount: 1,
          durability: 500,
          modelStyle: 'handheld',
          attributes: [{ id: 'attack_damage', amount: 8, slot: 'mainhand' }]
        }
      ],
      recipes: [],
      commands: [],
      unsupportedRequests: [
        { feature: 'mace combat', reason: 'not emitted' },
        { feature: 'life steal', reason: 'not emitted' }
      ],
      source: 'merged',
      prompt: 'Legendary Mace with life steal'
    })
    const files = planForgeFiles(manifest, spec)
    const java = files.map((file) => file.contents.toString()).join('\n')
    expect(java).toContain('new Item(')
    expect(java).toContain('Attributes.ATTACK_DAMAGE')
    expect(java).not.toMatch(/smash|lifesteal|life steal|shockwave|Enchantment|breakBlock/i)
  })
})

describe('app version', () => {
  it('is 1.0.5', () => {
    expect(APP_VERSION).toBe('1.0.5')
  })
})
