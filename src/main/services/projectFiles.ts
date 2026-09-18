import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../../shared/errors'
import { isEditableProjectPath } from '../codegen/allowlist'
import { assertInsideRoot, resolveProjectFile, resolveProjectsRoot } from './pathSafety'

const SKIP_DIRS = new Set(['.gradle', 'build', 'run', 'out', 'node_modules', '.git'])
const MAX_FILE_BYTES = 256_000

export interface ProjectFileNode {
  name: string
  relativePath: string
  type: 'file' | 'directory'
  children?: ProjectFileNode[]
}

export async function listProjectTree(projectsRoot: string, projectDirName: string): Promise<ProjectFileNode[]> {
  const root = resolveProjectsRoot(projectsRoot)
  const projectRoot = resolveProjectFile(root, projectDirName, 'craftstudio.project.json')
  const folder = path.dirname(projectRoot)
  return await walk(folder, folder, 0)
}

async function walk(folder: string, projectRoot: string, depth: number): Promise<ProjectFileNode[]> {
  if (depth > 8) {
    return []
  }
  const entries = await readdir(folder, { withFileTypes: true })
  const nodes: ProjectFileNode[] = []
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.org.')) {
      continue
    }
    const full = path.join(folder, entry.name)
    assertInsideRoot(projectRoot, full)
    const relativePath = path.relative(projectRoot, full).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        relativePath,
        type: 'directory',
        children: await walk(full, projectRoot, depth + 1)
      })
    } else if (entry.isFile()) {
      nodes.push({ name: entry.name, relativePath, type: 'file' })
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

export async function readProjectFile(
  projectsRoot: string,
  projectDirName: string,
  relativePath: string
): Promise<{ relativePath: string; contents: string; truncated: boolean }> {
  const target = resolveProjectFile(projectsRoot, projectDirName, relativePath)
  const info = await stat(target)
  if (!info.isFile()) {
    throw new AppError({
      code: 'VALIDATION',
      message: 'That path is not a file.',
      action: 'Pick a file from the tree.'
    })
  }
  if (info.size > MAX_FILE_BYTES) {
    const buf = await readFile(target)
    return {
      relativePath,
      contents: `${buf.subarray(0, MAX_FILE_BYTES).toString('utf8')}\n… truncated`,
      truncated: true
    }
  }
  return { relativePath, contents: await readFile(target, 'utf8'), truncated: false }
}

export async function writeProjectFile(
  projectsRoot: string,
  projectDirName: string,
  relativePath: string,
  contents: string
): Promise<{ relativePath: string; bytes: number }> {
  if (!isEditableProjectPath(relativePath)) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `Refusing to edit "${relativePath}".`,
      action: 'Only allowlisted text sources can be edited. PNGs go through the texture editor. Binary jars are not writable.'
    })
  }
  if (contents.length > MAX_FILE_BYTES) {
    throw new AppError({
      code: 'VALIDATION',
      message: 'Edited file exceeds the 256 KB editor limit.',
      action: 'Split the change or edit the file outside CraftStudio.'
    })
  }
  const target = resolveProjectFile(projectsRoot, projectDirName, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, contents, 'utf8')
  return { relativePath, bytes: Buffer.byteLength(contents, 'utf8') }
}
