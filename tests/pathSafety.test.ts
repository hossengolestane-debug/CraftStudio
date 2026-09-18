import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppError } from '../src/shared/errors'
import {
  assertInsideRoot,
  assertSafeSegment,
  resolveContainedPath,
  toProjectDirectoryName
} from '../src/main/services/pathSafety'

const root = path.join(os.tmpdir(), 'craftstudio-projects-root')

describe('path safety', () => {
  it('resolves a child path inside the projects root', () => {
    const target = resolveContainedPath(root, 'my-mod-abc123')
    expect(target.startsWith(path.resolve(root) + path.sep)).toBe(true)
  })

  it('allows the projects root itself', () => {
    expect(assertInsideRoot(root, root)).toBe(path.resolve(root))
  })

  it('rejects parent traversal segments', () => {
    expect(() => resolveContainedPath(root, '..')).toThrow(AppError)
    expect(() => resolveContainedPath(root, 'ok', '..', 'secret')).toThrow(/\.\./)
  })

  it('rejects slash-containing segments', () => {
    expect(() => resolveContainedPath(root, '../escape')).toThrow(AppError)
    expect(() => resolveContainedPath(root, 'a/b')).toThrow(/slashes/)
    expect(() => resolveContainedPath(root, 'a\\b')).toThrow(/slashes/)
  })

  it('rejects absolute segments', () => {
    expect(() => assertSafeSegment('/etc/passwd')).toThrow(/slashes|absolute/)
    expect(() => assertSafeSegment('C:\\Windows')).toThrow(/slashes|absolute/)
    expect(() => resolveContainedPath(root, path.resolve('/tmp'))).toThrow(AppError)
  })

  it('rejects null bytes', () => {
    expect(() => resolveContainedPath(root, 'bad\0name')).toThrow(/null byte/)
  })

  it('rejects Windows reserved device names', () => {
    expect(() => assertSafeSegment('CON')).toThrow(/reserved Windows/)
    expect(() => assertSafeSegment('nul.txt')).toThrow(/reserved Windows/)
  })

  it('rejects writes that resolve outside the root even if the input looks local', () => {
    const sneaky = path.resolve(root, '..', 'outside')
    expect(() => assertInsideRoot(root, sneaky)).toThrow(/outside the projects folder/)
  })

  it('builds a confined project directory name', () => {
    const name = toProjectDirectoryName('Cool Mod!!', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    expect(name).toBe('cool-mod-aaaaaaaa')
    expect(() => resolveContainedPath(root, name)).not.toThrow()
  })
})
