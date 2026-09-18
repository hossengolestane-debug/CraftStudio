import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { planFabricFiles } from '../src/main/codegen/fabric/emitter'
import { writePlannedFiles } from '../src/main/services/filePlan'
import { parseProjectSpec } from '../src/shared/spec'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const manifest: ProjectManifest = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  name: 'River Stones',
  description: 'Adds polished river stones.',
  type: 'mod',
  platform: 'fabric',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T01:00:00.000Z',
  updatedAt: '2026-09-18T01:00:00.000Z',
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
  schemaVersion: 1,
  modId: 'river_stones',
  displayName: 'River Stones',
  description: 'Adds polished river stones.',
  packageName: 'local.craftstudio.river_stones',
  mainClass: 'RiverStones',
  items: [{ id: 'river_stone', displayName: 'River Stone', maxCount: 16, rarity: 'common' }],
  recipes: [
    {
      id: 'river_stone_from_cobble',
      type: 'shapeless',
      resultItemId: 'river_stone',
      resultCount: 1,
      ingredients: [{ kind: 'vanilla', id: 'minecraft:cobblestone' }]
    }
  ],
  commands: [{ name: 'pebble', description: 'stub' }],
  unsupportedRequests: [],
  source: 'template',
  prompt: 'item + recipe'
})

describe('Fabric adapter generation', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('emits a Gradle tree with pinned versions and a custom item', async () => {
    const files = planFabricFiles(manifest, spec)
    const paths = files.map((file) => file.relativePath)
    expect(paths).toContain('build.gradle')
    expect(paths).toContain('gradle/wrapper/gradle-wrapper.jar')
    expect(paths).toContain('src/main/java/local/craftstudio/river_stones/RiverStones.java')

    const gradle = files.find((file) => file.relativePath === 'build.gradle')?.contents.toString() ?? ''
    expect(gradle).toContain("id 'fabric-loom' version '1.9.2'")
    expect(gradle).toContain('net.fabricmc:yarn')
    expect(gradle).not.toMatch(/curl |rm -rf|wget /)

    const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(java).toContain('Identifier.of(MOD_ID, "river_stone")')
    expect(java).toContain('maxCount(16)')
    expect(java).toContain('Command /pebble is recorded in the spec only')

    const root = await mkdtemp(path.join(os.tmpdir(), 'cs-emit-'))
    temps.push(root)
    await writePlannedFiles(root, 'river-stones-aaaaaaaa', files)
    const written = await readFile(
      path.join(root, 'river-stones-aaaaaaaa', 'src/main/resources/fabric.mod.json'),
      'utf8'
    )
    expect(written).toContain('"id": "river_stones"')
    const recipe = await readFile(
      path.join(root, 'river-stones-aaaaaaaa', 'src/main/resources/data/river_stones/recipe/river_stone_from_cobble.json'),
      'utf8'
    )
    expect(recipe).toContain('minecraft:cobblestone')
  })

  it('refuses non-Fabric manifests and unsupported Minecraft versions', () => {
    expect(() => planFabricFiles({ ...manifest, platform: 'paper', type: 'plugin' }, spec)).toThrow(/Fabric/)
    expect(() => planFabricFiles({ ...manifest, minecraftVersion: '1.18.2' }, spec)).toThrow(/1\.21/)
  })
})
