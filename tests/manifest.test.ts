import { describe, expect, it } from 'vitest'
import { AppError } from '../src/shared/errors'
import { parseManifestJson, validateManifest } from '../src/shared/manifest'
import { MANIFEST_SCHEMA_VERSION } from '../src/shared/types'

const valid = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'Example Mod',
  description: 'A demo',
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
    recipes: false
  },
  schemaVersion: MANIFEST_SCHEMA_VERSION
}

describe('manifest validation', () => {
  it('accepts a complete Phase 1 manifest', () => {
    expect(validateManifest(valid).name).toBe('Example Mod')
  })

  it('parses JSON', () => {
    expect(parseManifestJson(JSON.stringify(valid)).platform).toBe('fabric')
  })

  it('rejects malformed JSON', () => {
    expect(() => parseManifestJson('{')).toThrow(AppError)
  })

  it('rejects a plugin platform on a mod', () => {
    expect(() => validateManifest({ ...valid, platform: 'paper' })).toThrow(/does not match/)
  })

  it('rejects a mod platform on a plugin', () => {
    expect(() => validateManifest({ ...valid, type: 'plugin', platform: 'forge' })).toThrow(/does not match/)
  })

  it('rejects an unknown schema version', () => {
    expect(() => validateManifest({ ...valid, schemaVersion: 99 })).toThrow(/schemaVersion/)
  })

  it('rejects a non-UUID id', () => {
    expect(() => validateManifest({ ...valid, id: 'not-a-uuid' })).toThrow(/UUID/)
  })

  it('rejects a bad Minecraft version string', () => {
    expect(() => validateManifest({ ...valid, minecraftVersion: 'latest' })).toThrow(/minecraftVersion/)
  })

  it('rejects non-boolean feature flags', () => {
    expect(() =>
      validateManifest({
        ...valid,
        features: { ...valid.features, customItems: 'yes' }
      })
    ).toThrow(/boolean/)
  })
})
