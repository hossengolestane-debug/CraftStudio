import { AppError } from '../../shared/errors'
import { isCodegenSupported } from '../../shared/platformPins'
import type { ProjectSpec } from '../../shared/spec'
import type { PlatformId, ProjectManifest } from '../../shared/types'
import { planFabricFiles } from './fabric/emitter'
import { planPaperFiles } from './paper/emitter'
import type { PlannedFile } from './types'

export function assertCanGenerate(platform: PlatformId, minecraftVersion: string): void {
  if (isCodegenSupported(platform, minecraftVersion)) {
    return
  }
  if (platform === 'spigot') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: 'Spigot codegen is not implemented. Paper success is not Spigot compatibility.',
      action: 'Create a Paper 1.21.x project for the plugin slice, or wait for a dedicated Spigot emitter.'
    })
  }
  throw new AppError({
    code: 'ADAPTER_UNSUPPORTED',
    message: `${platform} + Minecraft ${minecraftVersion} has no Phase 3 emitter.`,
    action: 'Use Fabric 1.21 / 1.21.1 / 1.21.2 / 1.21.4 / 1.21.8 or Paper 1.21 / 1.21.1 / 1.21.4 / 1.21.8.'
  })
}

export function planAdapterFiles(manifest: ProjectManifest, spec: ProjectSpec): PlannedFile[] {
  assertCanGenerate(manifest.platform, manifest.minecraftVersion)
  if (manifest.platform === 'fabric') {
    return planFabricFiles(manifest, spec)
  }
  if (manifest.platform === 'paper') {
    return planPaperFiles(manifest, spec)
  }
  throw new AppError({
    code: 'ADAPTER_UNSUPPORTED',
    message: `${manifest.platform} generation is not implemented.`,
    action: 'Use Fabric or Paper.'
  })
}
