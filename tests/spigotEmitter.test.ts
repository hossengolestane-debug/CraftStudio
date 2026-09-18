import { describe, expect, it } from 'vitest'
import { PAPER_ONLY_MARKERS } from '../src/main/codegen/plugin/bukkit'
import { planSpigotFiles } from '../src/main/codegen/spigot/emitter'
import { parseProjectSpec } from '../src/shared/spec'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const manifest: ProjectManifest = {
  id: 'eeeeeeee-ffff-4111-8222-333333333333',
  name: 'Copper Charm',
  description: 'A spigot plugin item.',
  type: 'plugin',
  platform: 'spigot',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T04:00:00.000Z',
  updatedAt: '2026-09-18T04:00:00.000Z',
  features: {
    customItems: true,
    customMobs: true,
    customGuis: true,
    customBlocks: false,
    recipes: true
  },
  schemaVersion: MANIFEST_SCHEMA_VERSION
}

const spec = parseProjectSpec({
  schemaVersion: 1,
  modId: 'copper_charm',
  displayName: 'Copper Charm',
  description: 'A spigot plugin item.',
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
  commands: [],
  mobs: [
    {
      id: 'charm_wolf',
      displayName: 'Charm Wolf',
      health: 16,
      preset: 'neutral_flee',
      targeting: 'none',
      appearance: { model: 'quadruped', vanillaBase: 'minecraft:wolf' }
    }
  ],
  pluginGuis: [
    {
      id: 'charm_menu',
      title: 'Charm Menu',
      rows: 3,
      pagination: true,
      slots: [{ index: 11, iconKind: 'vanilla', iconId: 'minecraft:paper', label: 'Info', action: 'message' }]
    }
  ],
  unsupportedRequests: [],
  source: 'template',
  prompt: 'item'
})

describe('Spigot adapter generation', () => {
  it('emits spigot-api Gradle and refuses Paper-only APIs', () => {
    const files = planSpigotFiles(manifest, spec)
    const javaAndGradle = files
      .filter((file) => file.relativePath.endsWith('.java') || file.relativePath.endsWith('.gradle'))
      .map((file) => file.contents.toString())
      .join('\n')
    const gradle = files.find((file) => file.relativePath === 'build.gradle')?.contents.toString() ?? ''
    expect(gradle).toContain('org.spigotmc:spigot-api:1.21.1-R0.1-SNAPSHOT')
    expect(gradle).toContain('hub.spigotmc.org')
    expect(gradle).not.toContain('io.papermc')

    for (const marker of PAPER_ONLY_MARKERS) {
      expect(javaAndGradle, marker).not.toContain(marker)
    }

    expect(javaAndGradle).toContain('setDisplayName')
    expect(javaAndGradle).toContain('setCustomName')
    expect(javaAndGradle).toContain('EntityType.WOLF')
    expect(javaAndGradle).toContain('event.setCancelled(true)')
    expect(javaAndGradle).toContain('InventoryDragEvent')
    expect(javaAndGradle).toContain('yield entity')
    expect(javaAndGradle).not.toContain('org.jetbrains')
    const eula = files.find((file) => file.relativePath === 'run-spigot/eula.txt')?.contents.toString() ?? ''
    expect(eula).not.toContain('eula=true')
  })

  it('rejects Paper inference, 1.21.8, and Fabric manifests', () => {
    expect(() => planSpigotFiles({ ...manifest, platform: 'paper' }, spec)).toThrow(/Spigot/)
    expect(() => planSpigotFiles({ ...manifest, minecraftVersion: '1.21.8' }, spec)).toThrow(/Spigot codegen/)
    expect(() => planSpigotFiles({ ...manifest, platform: 'fabric', type: 'mod' }, spec)).toThrow(/Spigot/)
  })
})
