import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { planPaperFiles } from '../src/main/codegen/paper/emitter'
import { writePlannedFiles } from '../src/main/services/filePlan'
import { parseProjectSpec } from '../src/shared/spec'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const manifest: ProjectManifest = {
  id: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',
  name: 'Copper Charm',
  description: 'A paper plugin item.',
  type: 'plugin',
  platform: 'paper',
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
  modId: 'copper_charm',
  displayName: 'Copper Charm',
  description: 'A paper plugin item.',
  packageName: 'local.craftstudio.copper_charm',
  mainClass: 'CopperCharm',
  items: [{ id: 'copper_charm', displayName: 'Copper Charm', maxCount: 16, rarity: 'common' }],
  recipes: [
    {
      id: 'copper_charm_recipe',
      type: 'shapeless',
      resultItemId: 'copper_charm',
      resultCount: 1,
      ingredients: [{ kind: 'vanilla', id: 'minecraft:copper_ingot' }]
    }
  ],
  commands: [{ name: 'charm', description: 'Give the charm' }],
  unsupportedRequests: [],
  source: 'template',
  prompt: 'item'
})

describe('Paper adapter generation', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('emits plugin.yml, PDC item factory, and Paper API pins', async () => {
    const files = planPaperFiles(manifest, spec)
    const paths = files.map((file) => file.relativePath)
    expect(paths).toContain('src/main/resources/plugin.yml')
    expect(paths).toContain('src/main/java/local/craftstudio/copper_charm/CopperCharm.java')
    expect(paths).toContain('run-paper/eula.txt')

    const gradle = files.find((file) => file.relativePath === 'build.gradle')?.contents.toString() ?? ''
    expect(gradle).toContain('io.papermc.paper:paper-api:1.21.1-R0.1-SNAPSHOT')
    expect(gradle).not.toMatch(/curl |rm -rf|wget /)

    const java = files.find((file) => file.relativePath.endsWith('CopperCharm.java'))?.contents.toString() ?? ''
    expect(java).toContain('extends JavaPlugin')
    expect(java).toContain('PersistentDataType.STRING')
    expect(java).toContain('Material.PAPER')
    expect(java).toContain('Material.COPPER_INGOT')
    expect(java).toContain('setCustomModelData(1)')
    expect(java).toContain('clients do not see a new item id')

    const yml = files.find((file) => file.relativePath === 'src/main/resources/plugin.yml')?.contents.toString() ?? ''
    expect(yml).toContain('givecustomitem')
    expect(yml).toContain('api-version: \'1.21\'')

    const eula = files.find((file) => file.relativePath === 'run-paper/eula.txt')?.contents.toString() ?? ''
    expect(eula).toContain('eula=false')
    expect(eula).not.toContain('eula=true')

    const root = await mkdtemp(path.join(os.tmpdir(), 'cs-paper-'))
    temps.push(root)
    await writePlannedFiles(root, 'copper-charm-bbbbbbbb', files)
    const written = await readFile(
      path.join(root, 'copper-charm-bbbbbbbb', 'src/main/resources/plugin.yml'),
      'utf8'
    )
    expect(written).toContain('main: local.craftstudio.copper_charm.CopperCharm')
  })

  it('refuses Fabric manifests, Spigot inference, and unsupported versions', () => {
    expect(() => planPaperFiles({ ...manifest, platform: 'fabric', type: 'mod' }, spec)).toThrow(/Paper/)
    expect(() => planPaperFiles({ ...manifest, platform: 'spigot' }, spec)).toThrow(/Paper/)
    expect(() => planPaperFiles({ ...manifest, minecraftVersion: '1.18.2' }, spec)).toThrow(/Paper codegen/)
  })
})
