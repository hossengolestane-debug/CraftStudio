import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { AppError } from '../../shared/errors'
import { resolveProjectFile } from './pathSafety'

const SKIP = new Set(['.gradle', 'build', 'run', 'out', 'node_modules', '.git', 'snapshots'])

export type SnapshotReason = 'before-apply' | 'before-version-change'

export interface SnapshotRecord {
  id: string
  reason: SnapshotReason
  createdAt: string
  platform: string
  minecraftVersion: string
  fileCount: number
  relativePath: string
}

export async function createProjectSnapshot(
  projectsRoot: string,
  projectDirName: string,
  reason: SnapshotReason,
  meta: { platform: string; minecraftVersion: string }
): Promise<SnapshotRecord> {
  const id = `${reason}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const relativeRoot = `snapshots/${id}`
  const dest = resolveProjectFile(projectsRoot, projectDirName, `${relativeRoot}/snapshot.json`)
  await mkdir(path.dirname(dest), { recursive: true })
  const files = await collectRelatives(projectsRoot, projectDirName, '')
  let copied = 0
  for (const relative of files) {
    const from = resolveProjectFile(projectsRoot, projectDirName, relative)
    const to = resolveProjectFile(projectsRoot, projectDirName, `${relativeRoot}/files/${relative}`)
    await mkdir(path.dirname(to), { recursive: true })
    await cp(from, to)
    copied += 1
  }
  const record: SnapshotRecord = {
    id,
    reason,
    createdAt: new Date().toISOString(),
    platform: meta.platform,
    minecraftVersion: meta.minecraftVersion,
    fileCount: copied,
    relativePath: relativeRoot
  }
  await writeFile(dest, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  return record
}

export async function listProjectSnapshots(
  projectsRoot: string,
  projectDirName: string
): Promise<SnapshotRecord[]> {
  const folder = resolveProjectFile(projectsRoot, projectDirName, 'snapshots')
  let names: string[]
  try {
    names = await readdir(folder)
  } catch {
    return []
  }
  const records: SnapshotRecord[] = []
  for (const name of names) {
    try {
      const raw = await readFile(resolveProjectFile(projectsRoot, projectDirName, `snapshots/${name}/snapshot.json`), 'utf8')
      records.push(JSON.parse(raw) as SnapshotRecord)
    } catch {
      // skip create-time manifest-only snapshots
    }
  }
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function restoreProjectSnapshot(
  projectsRoot: string,
  projectDirName: string,
  snapshotId: string
): Promise<SnapshotRecord> {
  if (snapshotId.includes('..') || snapshotId.includes('/') || snapshotId.includes('\\')) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: 'Invalid snapshot id.',
      action: 'Pick a snapshot from the list.'
    })
  }
  const raw = await readFile(
    resolveProjectFile(projectsRoot, projectDirName, `snapshots/${snapshotId}/snapshot.json`),
    'utf8'
  )
  const record = JSON.parse(raw) as SnapshotRecord
  const filesRoot = resolveProjectFile(projectsRoot, projectDirName, `snapshots/${snapshotId}/files`)
  const relatives = await walkFiles(filesRoot, filesRoot)
  for (const relative of relatives) {
    const from = resolveProjectFile(projectsRoot, projectDirName, `snapshots/${snapshotId}/files/${relative}`)
    const to = resolveProjectFile(projectsRoot, projectDirName, relative)
    await mkdir(path.dirname(to), { recursive: true })
    await cp(from, to, { force: true })
  }
  return record
}

async function collectRelatives(
  projectsRoot: string,
  projectDirName: string,
  relativeDir: string
): Promise<string[]> {
  const abs =
    relativeDir.length === 0
      ? path.join(projectsRoot, projectDirName)
      : resolveProjectFile(projectsRoot, projectDirName, relativeDir)
  const names = await readdir(abs)
  const files: string[] = []
  for (const name of names) {
    if (SKIP.has(name) || name === '.' || name === '..') {
      continue
    }
    const relative = relativeDir ? `${relativeDir}/${name}` : name
    const info = await stat(resolveProjectFile(projectsRoot, projectDirName, relative))
    if (info.isDirectory()) {
      files.push(...(await collectRelatives(projectsRoot, projectDirName, relative)))
    } else if (info.isFile() && !relative.endsWith('.jar')) {
      files.push(relative)
    }
  }
  return files
}

async function walkFiles(folder: string, root: string): Promise<string[]> {
  const names = await readdir(folder)
  const files: string[] = []
  for (const name of names) {
    const full = path.join(folder, name)
    const info = await stat(full)
    const relative = path.relative(root, full).replace(/\\/g, '/')
    if (info.isDirectory()) {
      files.push(...(await walkFiles(full, root)))
    } else {
      files.push(relative)
    }
  }
  return files
}

export async function removeOldestSnapshots(
  projectsRoot: string,
  projectDirName: string,
  keep = 8
): Promise<void> {
  const records = await listProjectSnapshots(projectsRoot, projectDirName)
  for (const extra of records.slice(keep)) {
    await rm(resolveProjectFile(projectsRoot, projectDirName, `snapshots/${extra.id}`), {
      recursive: true,
      force: true
    })
  }
}
