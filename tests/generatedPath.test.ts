import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/shared/errors'
import { isTrustedOutputPath } from '../src/main/codegen/allowlist'
import { resolveProjectFile, splitRelativePath } from '../src/main/services/pathSafety'

const root = path.join(os.tmpdir(), 'cs-gen-root')

describe('generated path safety', () => {
  it('resolves nested source files inside the project folder', () => {
    const target = resolveProjectFile(root, 'my-mod-abc123', 'src/main/java/local/craftstudio/demo/Demo.java')
    expect(target.startsWith(path.resolve(root, 'my-mod-abc123') + path.sep)).toBe(true)
  })

  it('rejects traversal and absolute generated paths', () => {
    expect(() => splitRelativePath('../secret.txt')).toThrow(/\.\./)
    expect(() => resolveProjectFile(root, 'my-mod-abc123', '../../outside.txt')).toThrow(AppError)
    expect(() => resolveProjectFile(root, 'my-mod-abc123', '/etc/passwd')).toThrow(AppError)
  })

  it('rejects writes that escape into a sibling project', () => {
    expect(() => resolveProjectFile(root, 'alpha-11111111', '../beta-22222222/build.gradle')).toThrow(AppError)
  })

  it('only allowlists trusted output paths', () => {
    expect(isTrustedOutputPath('build.gradle')).toBe(true)
    expect(isTrustedOutputPath('src/main/java/local/craftstudio/x/X.java')).toBe(true)
    expect(isTrustedOutputPath('craftstudio/textures/demo.png')).toBe(true)
    expect(isTrustedOutputPath('src/main/resources/META-INF/neoforge.mods.toml')).toBe(true)
    expect(isTrustedOutputPath('SPAWNS.md')).toBe(true)
    expect(isTrustedOutputPath('ENTITY_RENDERING.md')).toBe(true)
    expect(isTrustedOutputPath('../craftstudio.project.json')).toBe(false)
    expect(isTrustedOutputPath('evil.sh')).toBe(false)
  })
})
