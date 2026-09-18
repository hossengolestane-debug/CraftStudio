import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../../shared/errors'
import { isBuildScriptPath, isTrustedOutputPath } from '../codegen/allowlist'
import type { PlannedFile } from '../codegen/fabric/emitter'
import { resolveProjectFile, resolveProjectsRoot } from './pathSafety'

export interface FileChange {
  relativePath: string
  action: 'create' | 'overwrite' | 'unchanged'
  previous?: string
  nextPreview?: string
  summary: string
  buildScript: boolean
}

const TEXT_PREVIEW = 800

function preview(text: string): string {
  return text.length > TEXT_PREVIEW ? `${text.slice(0, TEXT_PREVIEW)}\n…` : text
}

export async function diffPlannedFiles(
  projectsRoot: string,
  projectDirName: string,
  files: PlannedFile[]
): Promise<FileChange[]> {
  const changes: FileChange[] = []
  for (const file of files) {
    if (!isTrustedOutputPath(file.relativePath)) {
      throw new AppError({
        code: 'PATH_ESCAPE',
        message: `Refusing to write unlisted path "${file.relativePath}".`,
        action: 'Only trusted template paths can be generated.'
      })
    }
    const target = resolveProjectFile(projectsRoot, projectDirName, file.relativePath)
    let existing: Buffer | null = null
    try {
      existing = await readFile(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }

    const next = typeof file.contents === 'string' ? Buffer.from(file.contents, 'utf8') : file.contents
    const buildScript = isBuildScriptPath(file.relativePath)
    if (!existing) {
      changes.push({
        relativePath: file.relativePath,
        action: 'create',
        nextPreview: file.encoding === 'utf8' ? preview(next.toString('utf8')) : '[binary]',
        summary: `Create ${file.relativePath}`,
        buildScript
      })
      continue
    }
    if (existing.equals(next)) {
      changes.push({
        relativePath: file.relativePath,
        action: 'unchanged',
        summary: `${file.relativePath} already matches the template.`,
        buildScript
      })
      continue
    }
    changes.push({
      relativePath: file.relativePath,
      action: 'overwrite',
      previous: file.encoding === 'utf8' ? preview(existing.toString('utf8')) : '[binary]',
      nextPreview: file.encoding === 'utf8' ? preview(next.toString('utf8')) : '[binary]',
      summary: `Overwrite ${file.relativePath} (${existing.length} → ${next.length} bytes)`,
      buildScript
    })
  }
  return changes
}

export async function writePlannedFiles(
  projectsRoot: string,
  projectDirName: string,
  files: PlannedFile[]
): Promise<void> {
  resolveProjectsRoot(projectsRoot)
  for (const file of files) {
    if (!isTrustedOutputPath(file.relativePath)) {
      throw new AppError({
        code: 'PATH_ESCAPE',
        message: `Refusing to write unlisted path "${file.relativePath}".`,
        action: 'Only trusted template paths can be generated.'
      })
    }
    const target = resolveProjectFile(projectsRoot, projectDirName, file.relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    if (typeof file.contents === 'string') {
      await writeFile(target, file.contents, 'utf8')
    } else {
      await writeFile(target, file.contents)
    }
    if (file.relativePath === 'gradlew') {
      await chmod(target, 0o755)
    }
  }
}
