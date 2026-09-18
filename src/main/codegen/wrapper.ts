import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppError } from '../../shared/errors'
import type { PlannedFile } from './types'

export function wrapperAsset(name: string): Buffer {
  const here = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, 'wrapper', name),
    join(here, '../fabric/wrapper', name),
    join(here, '../../codegen/fabric/wrapper', name),
    join(here, '../../../src/main/codegen/fabric/wrapper', name),
    join(process.cwd(), 'src/main/codegen/fabric/wrapper', name)
  ]
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate)
    } catch {
      // try next
    }
  }
  throw new AppError({
    code: 'IO',
    message: `Missing vendored Gradle wrapper file "${name}".`,
    action: 'Reinstall the app sources so src/main/codegen/fabric/wrapper is present.'
  })
}

export function gradleWrapperFiles(gradleVersion: string): PlannedFile[] {
  return [
    {
      relativePath: 'gradle/wrapper/gradle-wrapper.properties',
      encoding: 'utf8',
      contents: [
        'distributionBase=GRADLE_USER_HOME',
        'distributionPath=wrapper/dists',
        `distributionUrl=https\\://services.gradle.org/distributions/gradle-${gradleVersion}-bin.zip`,
        'networkTimeout=10000',
        'validateDistributionUrl=true',
        'zipStoreBase=GRADLE_USER_HOME',
        'zipStorePath=wrapper/dists',
        ''
      ].join('\n')
    },
    {
      relativePath: 'gradle/wrapper/gradle-wrapper.jar',
      encoding: 'binary',
      contents: wrapperAsset('gradle-wrapper.jar')
    },
    {
      relativePath: 'gradlew',
      encoding: 'utf8',
      contents: wrapperAsset('gradlew').toString('utf8')
    },
    {
      relativePath: 'gradlew.bat',
      encoding: 'utf8',
      contents: wrapperAsset('gradlew.bat').toString('utf8')
    }
  ]
}

export function javaEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function yamlEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
