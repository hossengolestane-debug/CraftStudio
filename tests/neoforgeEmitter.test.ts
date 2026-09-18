import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { planNeoForgeFiles } from '../src/main/codegen/neoforge/emitter'
import { writePlannedFiles } from '../src/main/services/filePlan'
import { parseProjectSpec } from '../src/shared/spec'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const manifest: ProjectManifest = {
  id: 'dddddddd-eeee-4fff-8000-111111111111',
  name: 'River Stones',
  description: 'Adds polished river stones.',
  type: 'mod',
  platform: 'neoforge',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T02:00:00.000Z',
  updatedAt: '2026-09-18T02:00:00.000Z',
  features: {
    customItems: true,
    customMobs: false,
    customGuis: false,
    customBlocks: false,
    recipes: false
  },
  schemaVersion: MANIFEST_SCHEMA_VERSION
}

const spec = parseProjectSpec({
  schemaVersion: 1,
  modId: 'river_stones',
  displayName: 'River Stones',
  description: 'Adds polished river stones.',
  packageName: 'local.craftstudio.river_stones',
  mainClass: 'RiverStones',
  items: [{ id: 'river_stone', displayName: 'River Stone', maxCount: 16, rarity: 'common' }],
  recipes: [],
  commands: [],
  unsupportedRequests: [],
  source: 'template',
  prompt: 'item'
})

describe('NeoForge adapter generation', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('emits ModDevGradle pins, DeferredRegister items, and neoforge.mods.toml', async () => {
    const files = planNeoForgeFiles(manifest, spec)
    const gradle = files.find((file) => file.relativePath === 'build.gradle')?.contents.toString() ?? ''
    expect(gradle).toContain("id 'net.neoforged.moddev' version '2.0.147'")
    expect(gradle).toContain('archiveBaseName = project.mod_id')
    expect(gradle).toContain('neoForge {')
    expect(gradle).not.toContain('net.minecraftforge')
    expect(gradle).not.toMatch(/curl |rm -rf|wget /)

    const props = files.find((file) => file.relativePath === 'gradle.properties')?.contents.toString() ?? ''
    expect(props).toContain('neo_version=21.1.250')
    expect(props).toContain('minecraft_version=1.21.1')
    expect(props).toContain('not a Forge compatibility claim')

    const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(java).toContain('DeferredRegister.createItems')
    expect(java).toContain('registerSimpleItem')
    expect(java).toContain('river_stone')
    expect(java).toContain('@Mod(RiverStones.MOD_ID)')
    expect(java).not.toContain('net.minecraftforge')

    const toml = files.find((file) => file.relativePath === 'src/main/resources/META-INF/neoforge.mods.toml')
      ?.contents.toString() ?? ''
    expect(toml).toContain('modLoader="javafml"')
    expect(toml).toContain('modId="neoforge"')
    expect(toml).not.toContain('Forge compatibility')

    const root = await mkdtemp(path.join(os.tmpdir(), 'cs-neo-'))
    temps.push(root)
    await writePlannedFiles(root, 'river-stones-dddddddd', files)
    const written = await readFile(
      path.join(root, 'river-stones-dddddddd', 'src/main/resources/META-INF/neoforge.mods.toml'),
      'utf8'
    )
    expect(written).toContain('[[mods]]')
  })

  it('widens Experimental 1.21.4 / 1.21.8 pins and refuses Forge inference', () => {
    expect(() => planNeoForgeFiles({ ...manifest, platform: 'forge' }, spec)).toThrow(/NeoForge/)
    expect(() => planNeoForgeFiles({ ...manifest, minecraftVersion: '1.20.1' }, spec)).toThrow(/NeoForge codegen/)
    const v214 = planNeoForgeFiles({ ...manifest, minecraftVersion: '1.21.4' }, spec)
    expect(v214.find((file) => file.relativePath === 'gradle.properties')?.contents.toString()).toContain(
      'neo_version=21.4.157'
    )
    const v218 = planNeoForgeFiles({ ...manifest, minecraftVersion: '1.21.8' }, spec)
    expect(v218.find((file) => file.relativePath === 'gradle.properties')?.contents.toString()).toContain(
      'neo_version=21.8.54'
    )
  })

  it('emits entities on 1.21.1 only and writes MOBS.md on later pins', () => {
    const withMob = parseProjectSpec({
      ...spec,
      mobs: [
        {
          id: 'stone_mite',
          displayName: 'Stone Mite',
          health: 10,
          preset: 'passive_wanderer',
          targeting: 'none',
          appearance: { model: 'humanoid', vanillaBase: 'minecraft:zombie' }
        }
      ]
    })
    const v211 = planNeoForgeFiles(manifest, withMob)
    expect(v211.some((file) => file.relativePath.endsWith('StoneMiteEntity.java'))).toBe(true)
    const v214 = planNeoForgeFiles({ ...manifest, minecraftVersion: '1.21.4' }, withMob)
    expect(v214.some((file) => file.relativePath.endsWith('StoneMiteEntity.java'))).toBe(false)
    expect(v214.some((file) => file.relativePath === 'MOBS.md')).toBe(true)
  })
})
