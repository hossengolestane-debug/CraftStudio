export const TRUSTED_OUTPUT_PATHS = new Set([
  'craftstudio.spec.json',
  'README.md',
  '.gitignore',
  'build.gradle',
  'settings.gradle',
  'gradle.properties',
  'gradlew',
  'gradlew.bat',
  'gradle/wrapper/gradle-wrapper.properties',
  'gradle/wrapper/gradle-wrapper.jar'
])

export const BUILD_SCRIPT_PATHS = new Set([
  'build.gradle',
  'settings.gradle',
  'gradle.properties',
  'gradle/wrapper/gradle-wrapper.properties'
])

const SRC_PREFIXES = ['src/main/java/', 'src/main/resources/']

export function isTrustedOutputPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/')
  if (TRUSTED_OUTPUT_PATHS.has(normalized)) {
    return true
  }
  return SRC_PREFIXES.some((prefix) => normalized.startsWith(prefix) && !normalized.includes('..'))
}

export function isBuildScriptPath(relativePath: string): boolean {
  return BUILD_SCRIPT_PATHS.has(relativePath.replace(/\\/g, '/'))
}
