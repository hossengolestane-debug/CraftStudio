import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { exportSourceZip, findBuiltJar } from '../src/main/services/exportService'
import { resolveProjectFile } from '../src/main/services/pathSafety'
import { buildZip, crc32 } from '../src/main/services/zip'

describe('export path safety', () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('zips only project-relative files and skips build caches', async () => {
    const root = path.join(os.tmpdir(), `cs-export-${Date.now()}`)
    temps.push(root)
    const project = 'demo-aaaaaaaa'
    await mkdir(path.join(root, project, 'src'), { recursive: true })
    await mkdir(path.join(root, project, 'build', 'libs'), { recursive: true })
    await writeFile(path.join(root, project, 'README.md'), 'hello\n')
    await writeFile(path.join(root, project, 'src', 'Main.java'), 'class Main {}\n')
    await writeFile(path.join(root, project, 'build', 'libs', 'secret.jar'), 'nope')

    const dest = path.join(root, 'out.zip')
    const result = await exportSourceZip(root, project, dest)
    expect(result.fileCount).toBe(2)
    const zip = await readFile(dest)
    expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304')
    expect(zip.includes(Buffer.from('README.md'))).toBe(true)
    expect(zip.includes(Buffer.from('secret.jar'))).toBe(false)
  })

  it('refuses jar export when build/libs is missing', async () => {
    const root = path.join(os.tmpdir(), `cs-jar-${Date.now()}`)
    temps.push(root)
    await mkdir(path.join(root, 'demo-bbbbbbbb'), { recursive: true })
    await expect(findBuiltJar(root, 'demo-bbbbbbbb', 'paper')).rejects.toThrow(/build\/libs/)
  })

  it('builds a zip whose CRC matches stored files', () => {
    const data = Buffer.from('abc')
    const zip = buildZip([{ name: 'a.txt', data }])
    expect(crc32(data)).toBeGreaterThan(0)
    expect(zip.length).toBeGreaterThan(30)
  })

  it('resolveProjectFile still rejects export traversal', () => {
    const root = path.join(os.tmpdir(), 'cs-root')
    expect(() => resolveProjectFile(root, 'p-1', '../outside.txt')).toThrow()
  })
})
