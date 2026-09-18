import path from 'node:path'
import { AppError } from '../../shared/errors'

const FORBIDDEN_NAMES = new Set(['.', '..'])
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export function assertSafeSegment(segment: string, label = 'path segment'): string {
  if (typeof segment !== 'string' || segment.length === 0) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `The ${label} is empty.`,
      action: 'Use a simple folder or file name without slashes.'
    })
  }

  if (segment.includes('\0')) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `The ${label} contains a null byte.`,
      action: 'Remove hidden characters and try again.',
      details: JSON.stringify(segment)
    })
  }

  if (segment.includes('/') || segment.includes('\\')) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `The ${label} cannot contain slashes.`,
      action: 'Use a single path name, not a nested or absolute path.',
      details: segment
    })
  }

  if (FORBIDDEN_NAMES.has(segment) || segment.includes('..')) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `The ${label} cannot include "." or "..".`,
      action: 'Choose a normal project folder name.',
      details: segment
    })
  }

  if (path.win32.isAbsolute(segment) || path.posix.isAbsolute(segment)) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `The ${label} cannot be an absolute path.`,
      action: 'Provide a name relative to the projects root.',
      details: segment
    })
  }

  if (WINDOWS_RESERVED.test(segment)) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: `The ${label} uses a reserved Windows device name.`,
      action: 'Pick a different name (avoid CON, PRN, AUX, NUL, COM1–9, LPT1–9).',
      details: segment
    })
  }

  return segment
}

export function resolveProjectsRoot(root: string): string {
  if (typeof root !== 'string' || root.trim().length === 0) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: 'Projects root is not set.',
      action: 'Set a projects folder in Settings.'
    })
  }
  if (root.includes('\0')) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: 'Projects root contains a null byte.',
      action: 'Choose a different projects folder in Settings.',
      details: JSON.stringify(root)
    })
  }
  return path.resolve(root)
}

export function resolveContainedPath(root: string, ...segments: string[]): string {
  const resolvedRoot = resolveProjectsRoot(root)
  for (const segment of segments) {
    assertSafeSegment(segment)
  }

  const target = path.resolve(resolvedRoot, ...segments)
  assertInsideRoot(resolvedRoot, target)
  return target
}

export function assertInsideRoot(root: string, candidate: string): string {
  const resolvedRoot = resolveProjectsRoot(root)
  const resolvedCandidate = path.resolve(candidate)

  if (resolvedCandidate.includes('\0')) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: 'Refusing a path that contains a null byte.',
      action: 'Choose a different location.',
      details: JSON.stringify(candidate)
    })
  }

  const relative = path.relative(resolvedRoot, resolvedCandidate)
  const escaped = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)

  if (escaped) {
    throw new AppError({
      code: 'PATH_ESCAPE',
      message: 'Refusing to read or write outside the projects folder.',
      action: 'Keep project files under the configured projects root, or change that root in Settings.',
      details: `root=${resolvedRoot}\ntarget=${resolvedCandidate}`
    })
  }

  if (process.platform === 'win32') {
    const rootDrive = path.parse(resolvedRoot).root.toLowerCase()
    const targetDrive = path.parse(resolvedCandidate).root.toLowerCase()
    if (rootDrive !== targetDrive) {
      throw new AppError({
        code: 'PATH_ESCAPE',
        message: 'Refusing to access a path on a different drive.',
        action: 'Keep projects on the same drive as the projects root.',
        details: `root=${resolvedRoot}\ntarget=${resolvedCandidate}`
      })
    }
  }

  return resolvedCandidate
}

export function toProjectDirectoryName(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const shortId = id.replace(/-/g, '').slice(0, 8)
  const base = slug.length > 0 ? slug : 'project'
  return assertSafeSegment(`${base}-${shortId}`, 'project folder name')
}
