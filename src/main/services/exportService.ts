import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AppError } from '../../shared/errors'
import type { PlatformId } from '../../shared/types'
import { assertInsideRoot, resolveProjectFile, splitRelativePath } from './pathSafety'
import { writeZipFile, type ZipEntry } from './zip'

const SKIP_DIRS = new Set(['.gradle', 'build', 'run', 'out', 'node_modules', '.idea'])

export interface ExportResult {
  kind: 'source-zip' | 'jar'
  destPath: string
  fileCount: number
  message: string
}

async function collectFiles(
  projectsRoot: string,
  projectDirName: string,
  relativeDir: string
): Promise<string[]> {
  const absDir =
    relativeDir.length === 0
      ? path.join(projectsRoot, projectDirName)
      : resolveProjectFile(projectsRoot, projectDirName, relativeDir)
  assertInsideRoot(path.join(projectsRoot, projectDirName), absDir)
  const names = await readdir(absDir)
  const files: string[] = []
  for (const name of names) {
    if (name === '.' || name === '..') {
      continue
    }
    const relative = relativeDir ? `${relativeDir}/${name}` : name
    splitRelativePath(relative)
    if (SKIP_DIRS.has(name)) {
      continue
    }
    const abs = resolveProjectFile(projectsRoot, projectDirName, relative)
    const info = await stat(abs)
    if (info.isDirectory()) {
      files.push(...(await collectFiles(projectsRoot, projectDirName, relative)))
    } else if (info.isFile()) {
      files.push(relative)
    }
  }
  return files
}

export async function exportSourceZip(
  projectsRoot: string,
  projectDirName: string,
  destPath: string
): Promise<ExportResult> {
  if (!destPath.toLowerCase().endsWith('.zip')) {
    throw new AppError({
      code: 'EXPORT_FAILED',
      message: 'Source export must be a .zip file.',
      action: 'Choose a destination ending in .zip.'
    })
  }
  if (destPath.includes('\0')) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: 'Export destination contains a null byte.',
      action: 'Choose a different save location.'
    })
  }

  const projectRoot = path.join(projectsRoot, projectDirName)
  const relatives = await collectFiles(projectsRoot, projectDirName, '')
  const entries: ZipEntry[] = []
  for (const relative of relatives) {
    const abs = resolveProjectFile(projectsRoot, projectDirName, relative)
    assertInsideRoot(projectRoot, abs)
    entries.push({ name: relative, data: await readFile(abs) })
  }
  if (entries.length === 0) {
    throw new AppError({
      code: 'EXPORT_FAILED',
      message: 'There are no project files to zip. Apply a spec first.',
      action: 'Generate and apply files on the Design tab, then export.'
    })
  }
  await writeZipFile(destPath, entries)
  return {
    kind: 'source-zip',
    destPath,
    fileCount: entries.length,
    message: `Wrote ${entries.length} files to ${destPath}.`
  }
}

export async function findBuiltJar(
  projectsRoot: string,
  projectDirName: string,
  platform: PlatformId
): Promise<string> {
  const libsRel = 'build/libs'
  const libsAbs = resolveProjectFile(projectsRoot, projectDirName, libsRel)
  let names: string[]
  try {
    names = await readdir(libsAbs)
  } catch {
    throw new AppError({
      code: 'EXPORT_FAILED',
      message: 'No build/libs folder. A successful Gradle build is required before JAR export.',
      action: 'Run Test → Gradle build, wait for exit 0, then export the JAR.'
    })
  }

  const jars = names.filter(
    (name) =>
      name.endsWith('.jar') &&
      !name.endsWith('-sources.jar') &&
      !name.includes('-dev') &&
      !name.endsWith('-javadoc.jar')
  )
  if (jars.length === 0) {
    throw new AppError({
      code: 'EXPORT_FAILED',
      message: `No ${platform} artifact jar in build/libs. Compile success is not assumed from a model reply.`,
      action: 'Run a real `./gradlew build` and confirm BUILD SUCCESSFUL.'
    })
  }
  jars.sort((a, b) => a.length - b.length)
  const chosen = jars[0]!
  return resolveProjectFile(projectsRoot, projectDirName, `${libsRel}/${chosen}`)
}

export async function exportBuiltJar(
  projectsRoot: string,
  projectDirName: string,
  platform: PlatformId,
  destPath: string
): Promise<ExportResult> {
  if (!destPath.toLowerCase().endsWith('.jar')) {
    throw new AppError({
      code: 'EXPORT_FAILED',
      message: 'JAR export must be a .jar file.',
      action: 'Choose a destination ending in .jar.'
    })
  }
  const source = await findBuiltJar(projectsRoot, projectDirName, platform)
  const data = await readFile(source)
  await writeFile(destPath, data)
  return {
    kind: 'jar',
    destPath,
    fileCount: 1,
    message: `Copied ${path.basename(source)} to ${destPath}.`
  }
}
