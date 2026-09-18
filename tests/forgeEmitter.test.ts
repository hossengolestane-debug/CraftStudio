import { describe, expect, it } from 'vitest'
import { planForgeFiles } from '../src/main/codegen/forge/emitter'
import { parseProjectSpec } from '../src/shared/spec'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const manifest: ProjectManifest = {
  id: 'ffffffff-1111-4222-8333-444444444444',
  name: 'River Stones',
  description: 'Adds polished river stones.',
  type: 'mod',
  platform: 'forge',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T04:00:00.000Z',
  updatedAt: '2026-09-18T04:00:00.000Z',
  features: {
    customItems: true,
    customMobs: true,
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
  items: [{ id: 'river_stone', displayName: 'River Stone', maxCount: 16, rarity: 'common', modelStyle: 'handheld' }],
  recipes: [],
  commands: [],
  mobs: [
    {
      id: 'stone_mite',
      displayName: 'Stone Mite',
      health: 12,
      movementSpeed: 0.28,
      attackDamage: 2,
      preset: 'hostile_melee',
      targeting: 'players',
      appearance: { model: 'humanoid', vanillaBase: 'minecraft:zombie' }
    }
  ],
  unsupportedRequests: [],
  source: 'template',
  prompt: 'item + mob'
})

describe('Forge adapter generation', () => {
  it('emits ForgeGradle pins, mods.toml mandatory=true, items, and preset entities', () => {
    const files = planForgeFiles(manifest, spec)
    const gradle = files.find((file) => file.relativePath === 'build.gradle')?.contents.toString() ?? ''
    expect(gradle).toContain("id 'net.minecraftforge.gradle' version '6.0.36'")
    expect(gradle).toContain('net.minecraftforge:forge')
    expect(gradle).not.toContain('neoforged')
    expect(gradle).not.toMatch(/curl |rm -rf|wget /)

    const props = files.find((file) => file.relativePath === 'gradle.properties')?.contents.toString() ?? ''
    expect(props).toContain('forge_version=52.1.16')
    expect(props).toContain('not a NeoForge compatibility claim')

    const toml = files.find((file) => file.relativePath === 'src/main/resources/META-INF/mods.toml')?.contents.toString() ?? ''
    expect(toml).toContain('modId="forge"')
    expect(toml).toContain('mandatory=true')
    expect(toml).not.toContain('type="required"')

    const java = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(java).toContain('DeferredRegister.create(ForgeRegistries.ITEMS')
    expect(java).toContain('river_stone')
    expect(java).toContain('STONE_MITE')
    expect(java).not.toContain('net.neoforged')

    const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
    expect(entity).toContain('extends Monster')
    expect(entity).toContain('MeleeAttackGoal')

    const model = files.find((file) => file.relativePath.endsWith('river_stone.json'))?.contents.toString() ?? ''
    expect(model).toContain('minecraft:item/handheld')
  })

  it('emits a container menu pair and extra presets from the designer', () => {
    const withGui = parseProjectSpec({
      ...spec,
      mobs: [
        {
          ...spec.mobs[0]!,
          preset: 'stationary_lookout',
          targeting: 'players'
        }
      ],
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
        }
      ]
    })
    const files = planForgeFiles(manifest, withGui)
    const menu = files.find((file) => file.relativePath.endsWith('ExampleMenu.java'))?.contents.toString() ?? ''
    expect(menu).toContain('extends AbstractContainerMenu')
    expect(menu).toContain('mayPlace')
    expect(menu).toContain('quickMoveStack')
    expect(menu).toContain('ItemStack.EMPTY')
    expect(files.some((file) => file.relativePath.endsWith('ExampleScreen.java'))).toBe(true)
    expect(files.some((file) => file.relativePath.endsWith('ModScreens.java'))).toBe(false)
    const main = files.find((file) => file.relativePath.endsWith('RiverStones.java'))?.contents.toString() ?? ''
    expect(main).toContain('opencustommenu')
    const entity = files.find((file) => file.relativePath.endsWith('StoneMiteEntity.java'))?.contents.toString() ?? ''
    expect(entity).toContain('LookAtPlayerGoal')
    expect(entity).toContain('NearestAttackableTargetGoal')
  })

  it('rejects NeoForge inference and unsupported versions', () => {
    expect(() => planForgeFiles({ ...manifest, platform: 'neoforge' }, spec)).toThrow(/Forge/)
    expect(() => planForgeFiles({ ...manifest, minecraftVersion: '1.21.4' }, spec)).toThrow(/1\.21\.1/)
    expect(() => planForgeFiles({ ...manifest, minecraftVersion: '1.21.8' }, spec)).toThrow(/1\.21\.1/)
  })
})
