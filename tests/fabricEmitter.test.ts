import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { planFabricFiles } from '../src/main/codegen/fabric/emitter'
import { writePlannedFiles } from '../src/main/services/filePlan'
import { parseProjectSpec } from '../src/shared/spec'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

function manifestFor(minecraftVersion: string): ProjectManifest {
  return {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    name: 'River Stones',
    description: 'Adds polished river stones.',
    type: 'mod',
    platform: 'fabric',
    minecraftVersion,
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

  it('emits classic Registry.register for 1.21.1', async () => {
    const files = planFabricFiles(manifestFor('1.21.1'), spec)
    const gradle = files.find((file) => file.relativePath === 'build.gradle')?.contents.toString() ?? ''
    expect(gradle).toContain("id 'fabric-loom' version '1.9.2'")
    expect(gradle).toContain('net.fabricmc:yarn')
    expect(gradle).not.toMatch(/curl |rm -rf|wget /)

    const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(java).toContain('Registry.register')
    expect(java).toContain('Identifier.of(MOD_ID, "river_stone")')
    expect(java).not.toContain('Items.register')
    expect(java).toContain('maxCount(16)')
    expect(java).toContain('CommandManager.literal("pebble")')

    const root = await mkdtemp(path.join(os.tmpdir(), 'cs-emit-'))
    temps.push(root)
    await writePlannedFiles(root, 'river-stones-aaaaaaaa', files)
    const written = await readFile(
      path.join(root, 'river-stones-aaaaaaaa', 'src/main/resources/fabric.mod.json'),
      'utf8'
    )
    expect(written).toContain('"id": "river_stones"')
  })

  it('emits Items.register + RegistryKey for 1.21.2, 1.21.4, and 1.21.8', () => {
    for (const version of ['1.21.2', '1.21.4', '1.21.8'] as const) {
      const files = planFabricFiles(manifestFor(version), spec)
      const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
      expect(java, version).toContain('Items.register')
      expect(java, version).toContain('RegistryKey<Item>')
      expect(java, version).toContain('RIVER_STONE_KEY')
      expect(java, version).not.toContain('Registry.register(')
      const props = files.find((file) => file.relativePath === 'gradle.properties')?.contents.toString() ?? ''
      expect(props).toContain(`minecraft_version=${version}`)
    }
    const loom18 = planFabricFiles(manifestFor('1.21.8'), spec)
      .find((file) => file.relativePath === 'build.gradle')
      ?.contents.toString()
    expect(loom18).toContain("id 'fabric-loom' version '1.10.1'")
  })

  it('refuses non-Fabric manifests and unsupported Minecraft versions', () => {
    expect(() => planFabricFiles({ ...manifestFor('1.21.1'), platform: 'paper', type: 'plugin' }, spec)).toThrow(
      /Fabric/
    )
    expect(() => planFabricFiles(manifestFor('1.18.2'), spec)).toThrow(/1\.21/)
  })

  it('registers preset mobs and a preview screen without vanilla-typed renderers', () => {
    const withExtras = parseProjectSpec({
      ...spec,
      mobs: [
        {
          id: 'stone_mite',
          displayName: 'Stone Mite',
          health: 12,
          preset: 'hostile_melee',
          targeting: 'players',
          appearance: { model: 'humanoid', vanillaBase: 'minecraft:zombie' }
        }
      ],
      modGuis: [
        {
          id: 'example_screen',
          title: 'Preview',
          width: 176,
          height: 166,
          widgets: [{ id: 'title_label', kind: 'label', x: 8, y: 6, width: 80, height: 12, text: 'Preview', action: 'none' }]
        }
      ]
    })
    const files = planFabricFiles(manifestFor('1.21.1'), withExtras)
    const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(java).toContain('STONE_MITE')
    expect(java).toContain('FabricDefaultAttributeRegistry')
    expect(java).toContain('FeatureFlags.VANILLA_FEATURES')
    expect(files.some((file) => file.relativePath.endsWith('StoneMiteEntity.java'))).toBe(true)
    expect(files.some((file) => file.relativePath.endsWith('ExampleScreen.java'))).toBe(true)
    expect(files.some((file) => file.relativePath.endsWith('StoneMiteEntityRenderer.java'))).toBe(true)
    expect(files.some((file) => file.relativePath.endsWith('CraftStudioMobModel.java'))).toBe(true)
    expect(files.some((file) => file.relativePath === 'ENTITY_RENDERING.md')).toBe(true)
    const renderer = files.find((file) => file.relativePath.endsWith('StoneMiteEntityRenderer.java'))?.contents.toString() ?? ''
    expect(renderer).toContain('CraftStudioMobModel')
    expect(renderer).not.toContain('ZombieEntityModel')
    expect(files.some((file) => file.relativePath.endsWith('RiverStonesClient.java'))).toBe(true)
    const modJson = files.find((file) => file.relativePath === 'src/main/resources/fabric.mod.json')?.contents.toString() ?? ''
    expect(modJson).toContain('RiverStonesClient')
  })

  it('emits a visible render-state cube on 1.21.4 and 1.21.8', () => {
    const withMob = parseProjectSpec({
      ...spec,
      mobs: [
        {
          id: 'stone_mite',
          displayName: 'Stone Mite',
          health: 12,
          preset: 'avoid_players',
          targeting: 'none',
          appearance: { model: 'humanoid', vanillaBase: 'minecraft:zombie' },
          spawn: { enabled: true, biomes: ['plains', 'forest'], weight: 8, minGroup: 1, maxGroup: 2 }
        }
      ]
    })
    const files = planFabricFiles(manifestFor('1.21.4'), withMob)
    const renderer = files.find((file) => file.relativePath.endsWith('StoneMiteEntityRenderer.java'))?.contents.toString() ?? ''
    expect(renderer).toContain('LivingEntityRenderState')
    expect(renderer).toContain('LivingEntityRenderer')
    expect(renderer).toContain('CraftStudioMobModel')
    expect(renderer).toContain('createRenderState')
    expect(files.some((file) => file.relativePath.endsWith('CraftStudioMobModel.java'))).toBe(true)
    const model = files.find((file) => file.relativePath.endsWith('CraftStudioMobModel.java'))?.contents.toString() ?? ''
    expect(model).toContain('EntityModel<LivingEntityRenderState>')
    expect(model).toContain('super(root)')
    const client = files.find((file) => file.relativePath.endsWith('RiverStonesClient.java'))?.contents.toString() ?? ''
    expect(client).not.toContain('invisible')
    expect(client).toContain('EntityModelLayerRegistry')
    const main = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(main).toContain('BiomeModifications.addSpawn')
    expect(main).toContain('BiomeKeys.PLAINS')
    expect(files.some((file) => file.relativePath === 'SPAWNS.md')).toBe(true)
    const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
    expect(entity).toContain('FleeEntityGoal')

    const v218 = planFabricFiles(manifestFor('1.21.8'), withMob)
    const model218 = v218.find((file) => file.relativePath.endsWith('CraftStudioMobModel.java'))?.contents.toString() ?? ''
    expect(model218).toContain('super(root)')
  })

  it('emits every mod screen with safer insertItem transfer and opencustommenu suggestions', () => {
    const multi = parseProjectSpec({
      ...spec,
      commands: [{ name: 'pebble', description: 'stub', permission: 'river_stones.command.pebble' }],
      modGuis: [
        {
          id: 'example_screen',
          title: 'Preview',
          width: 176,
          height: 166,
          widgets: [
            { id: 'title_label', kind: 'label', x: 8, y: 6, width: 80, height: 12, text: 'Preview', action: 'none' },
            { id: 'slot_0', kind: 'slot', x: 80, y: 60, width: 18, height: 18, text: '', action: 'none' }
          ]
        },
        {
          id: 'storage_screen',
          title: 'Storage',
          width: 176,
          height: 166,
          widgets: [{ id: 'slot_0', kind: 'slot', x: 80, y: 60, width: 18, height: 18, text: '', action: 'none' }]
        }
      ]
    })
    const files = planFabricFiles(manifestFor('1.21.1'), multi)
    expect(files.some((file) => file.relativePath.endsWith('ExampleScreenHandler.java'))).toBe(true)
    expect(files.some((file) => file.relativePath.endsWith('StorageScreenHandler.java'))).toBe(true)
    const handler = files.find((file) => file.relativePath.endsWith('ExampleScreenHandler.java'))?.contents.toString() ?? ''
    expect(handler).toContain('insertItem')
    expect(handler).toContain('canInsert')
    const main = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(main).toContain('STORAGE_SCREEN_MENU')
    expect(main).toContain('opencustommenu')
    expect(main).toContain('hasPermissionLevel(2)')
    expect(main).toContain('river_stones.command.pebble')
    const install = files.find((file) => file.relativePath === 'INSTALL.md')?.contents.toString() ?? ''
    expect(install).toContain('Permission nodes')
  })
})
