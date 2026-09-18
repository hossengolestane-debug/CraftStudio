import { describe, expect, it } from 'vitest'
import { isTrustedOutputPath } from '../src/main/codegen/allowlist'
import { planStandaloneResourcePack } from '../src/main/codegen/pack/planner'
import { hashDefaultTexture } from '../src/shared/textureCanvas'
import { encodePngRgba } from '../src/shared/png'
import { parseProjectSpec } from '../src/shared/spec'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const spec = parseProjectSpec({
  schemaVersion: 1,
  modId: 'harbor_tokens',
  displayName: 'Harbor Tokens',
  description: 'A token.',
  packageName: 'local.craftstudio.harbor_tokens',
  mainClass: 'HarborTokens',
  items: [{ id: 'harbor_token', displayName: 'Harbor Token', maxCount: 16, rarity: 'common' }],
  recipes: [],
  commands: [],
  unsupportedRequests: [],
  source: 'template',
  prompt: 'item'
})

function manifest(platform: ProjectManifest['platform'], minecraftVersion: string): ProjectManifest {
  return {
    id: 'cccccccc-dddd-4eee-8fff-000000000000',
    name: 'Harbor Tokens',
    description: 'A token.',
    type: platform === 'paper' ? 'plugin' : 'mod',
    platform,
    minecraftVersion,
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
}

function texturePng(): Buffer {
  return encodePngRgba(16, 16, hashDefaultTexture(16, 16, 'harbor_token'))
}

describe('resource pack path safety', () => {
  it('allowlists project texture and pack prefixes only', () => {
    expect(isTrustedOutputPath('craftstudio/textures/harbor_token.png')).toBe(true)
    expect(isTrustedOutputPath('resource-pack/pack.mcmeta')).toBe(true)
    expect(isTrustedOutputPath('resource-pack/assets/harbor_tokens/textures/item/harbor_token.png')).toBe(true)
    expect(isTrustedOutputPath('../craftstudio/textures/harbor_token.png')).toBe(false)
    expect(isTrustedOutputPath('evil.sh')).toBe(false)
  })

  it('exports Fabric pack.mcmeta + item texture/model paths', () => {
    const files = planStandaloneResourcePack(manifest('fabric', '1.21.1'), spec, {
      harbor_token: texturePng()
    })
    const paths = files.map((file) => file.relativePath)
    expect(paths).toContain('pack.mcmeta')
    expect(paths).toContain('pack.png')
    expect(paths).toContain('assets/harbor_tokens/textures/item/harbor_token.png')
    expect(paths).toContain('assets/harbor_tokens/models/item/harbor_token.json')
    const meta = JSON.parse(files.find((file) => file.relativePath === 'pack.mcmeta')!.contents.toString())
    expect(meta.pack.pack_format).toBe(34)
    const model = JSON.parse(
      files.find((file) => file.relativePath.endsWith('harbor_token.json'))!.contents.toString()
    )
    expect(model.textures.layer0).toBe('harbor_tokens:item/harbor_token')
    expect(model.parent).toBe('minecraft:item/generated')
  })

  it('exports handheld + layer1 models and Forge/Spigot packs', () => {
    const styled = parseProjectSpec({
      ...spec,
      items: [
        {
          id: 'harbor_token',
          displayName: 'Harbor Token',
          maxCount: 16,
          rarity: 'common',
          modelStyle: 'handheld',
          layer1: true
        }
      ]
    })
    const overlay = texturePng()
    const files = planStandaloneResourcePack(manifest('forge', '1.21.1'), styled, {
      harbor_token: texturePng(),
      harbor_token_layer1: overlay
    })
    const model = JSON.parse(
      files.find((file) => file.relativePath.endsWith('harbor_token.json'))!.contents.toString()
    )
    expect(model.parent).toBe('minecraft:item/handheld')
    expect(model.textures.layer1).toBe('harbor_tokens:item/harbor_token_layer1')
    expect(files.some((file) => file.relativePath.endsWith('harbor_token_layer1.png'))).toBe(true)
    expect(files.some((file) => file.relativePath === 'pack.png')).toBe(true)

    const spigot = planStandaloneResourcePack(manifest('spigot', '1.21.1'), spec, { harbor_token: texturePng() })
    expect(spigot.some((file) => file.relativePath === 'assets/minecraft/models/item/paper.json')).toBe(true)
  })

  it('exports Paper CustomModelData overrides for 1.21.1 and range_dispatch for 1.21.4', () => {
    const pred = planStandaloneResourcePack(manifest('paper', '1.21.1'), spec, { harbor_token: texturePng() })
    const paperModel = JSON.parse(
      pred.find((file) => file.relativePath === 'assets/minecraft/models/item/paper.json')!.contents.toString()
    )
    expect(paperModel.overrides[0].predicate.custom_model_data).toBe(1)
    expect(paperModel.overrides[0].model).toBe('harbor_tokens:item/harbor_token')

    const range = planStandaloneResourcePack(manifest('paper', '1.21.4'), spec, { harbor_token: texturePng() })
    expect(range.some((file) => file.relativePath === 'assets/minecraft/items/paper.json')).toBe(true)
    const items = JSON.parse(
      range.find((file) => file.relativePath === 'assets/minecraft/items/paper.json')!.contents.toString()
    )
    expect(items.model.type).toBe('minecraft:range_dispatch')
    expect(items.model.property).toBe('minecraft:custom_model_data')
  })

  it('refuses export without a real texture and refuses traversal-style paths', () => {
    expect(() => planStandaloneResourcePack(manifest('fabric', '1.21.1'), spec, {})).toThrow(/No painted/)
    expect(isTrustedOutputPath('resource-pack/../../etc/passwd')).toBe(false)
  })
})
