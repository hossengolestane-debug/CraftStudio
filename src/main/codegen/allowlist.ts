export const TRUSTED_OUTPUT_PATHS = new Set([
  'craftstudio.spec.json',
  'README.md',
  'INSTALL.md',
  '.gitignore',
  'build.gradle',
  'settings.gradle',
  'gradle.properties',
  'gradlew',
  'gradlew.bat',
  'gradle/wrapper/gradle-wrapper.properties',
  'gradle/wrapper/gradle-wrapper.jar',
  'run-paper/README.md',
  'run-paper/eula.txt',
  'run-spigot/README.md',
  'run-spigot/eula.txt',
  'pack.mcmeta',
  'pack.png',
  'ENTITY_RENDERING.md',
  'MOBS.md'
])

export const BUILD_SCRIPT_PATHS = new Set([
  'build.gradle',
  'settings.gradle',
  'gradle.properties',
  'gradle/wrapper/gradle-wrapper.properties'
])

const TRUSTED_PREFIXES = [
  'src/main/java/',
  'src/main/resources/',
  'craftstudio/textures/',
  'resource-pack/',
  'snapshots/',
  'run-spigot/'
]

const EDITABLE_SUFFIXES = [
  '.java',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.md',
  '.properties',
  '.txt',
  '.gradle',
  '.pixels.json'
]

export function isTrustedOutputPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/')
  if (normalized.includes('..')) {
    return false
  }
  if (TRUSTED_OUTPUT_PATHS.has(normalized)) {
    return true
  }
  return TRUSTED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

export function isBuildScriptPath(relativePath: string): boolean {
  return BUILD_SCRIPT_PATHS.has(relativePath.replace(/\\/g, '/'))
}

export function isEditableProjectPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/')
  if (normalized.includes('..') || normalized.endsWith('.jar') || normalized.endsWith('.png')) {
    return false
  }
  if (TRUSTED_OUTPUT_PATHS.has(normalized) && !normalized.endsWith('.jar')) {
    return EDITABLE_SUFFIXES.some((suffix) => normalized.endsWith(suffix)) || normalized === 'gradlew' || normalized === 'gradlew.bat'
  }
  return (
    isTrustedOutputPath(normalized) &&
    EDITABLE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  )
}
