import { isCodegenSupported } from './platformPins'
import type { PlatformId, ProjectFeatures } from './types'

export interface MigrationAssessment {
  fromVersion: string
  toVersion: string
  platform: PlatformId
  canApply: boolean
  incompatible: string[]
  notes: string[]
}

export function assessVersionChange(
  platform: PlatformId,
  fromVersion: string,
  toVersion: string,
  features: ProjectFeatures
): MigrationAssessment {
  const notes: string[] = []
  const incompatible: string[] = []
  if (fromVersion === toVersion) {
    return {
      fromVersion,
      toVersion,
      platform,
      canApply: true,
      incompatible,
      notes: ['Version is unchanged.']
    }
  }
  const fromOk = isCodegenSupported(platform, fromVersion)
  const toOk = isCodegenSupported(platform, toVersion)
  if (!toOk) {
    incompatible.push(`${platform} has no CraftStudio emitter for Minecraft ${toVersion}.`)
  }
  if (fromOk && !toOk) {
    notes.push('Applying this change would leave the project without a trusted Gradle emitter.')
  }
  if (platform === 'neoforge' && features.customMobs) {
    notes.push(
      'NeoForge emits preset entity registration for 1.21.1, 1.21.4, and 1.21.8. That is not a Forge compatibility claim.'
    )
  }
  if (platform === 'spigot' && toVersion === '1.21.8') {
    incompatible.push('Spigot 1.21.8 is unsupported in the registry. Paper 1.21.8 is not Spigot.')
  }
  if (platform === 'forge' && toVersion !== '1.21.1') {
    incompatible.push('Forge codegen is pinned to 1.21.1 only. NeoForge is a separate adapter.')
  }
  if (features.customMobs && (platform === 'paper' || platform === 'spigot')) {
    notes.push('Plugin mobs stay vanilla disguises. A version change does not add new client entity types.')
  }
  if (features.customGuis) {
    notes.push('GUI layouts are preview-only until a Minecraft runtime is recorded as evidence.')
  }
  notes.push('A snapshot is taken before the version change is written.')
  return {
    fromVersion,
    toVersion,
    platform,
    canApply: incompatible.length === 0,
    incompatible,
    notes
  }
}
