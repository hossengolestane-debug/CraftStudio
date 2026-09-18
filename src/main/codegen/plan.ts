import { AppError } from '../../shared/errors'
import { isCodegenSupported } from '../../shared/platformPins'
import type { ProjectSpec } from '../../shared/spec'
import type { PlatformId, ProjectManifest } from '../../shared/types'
import { planFabricFiles } from './fabric/emitter'
import { planForgeFiles } from './forge/emitter'
import { planNeoForgeFiles } from './neoforge/emitter'
import { planPaperFiles } from './paper/emitter'
import { planSpigotFiles } from './spigot/emitter'
import type { PlannedFile } from './types'

export function assertCanGenerate(platform: PlatformId, minecraftVersion: string): void {
  if (isCodegenSupported(platform, minecraftVersion)) {
    return
  }
  if (platform === 'spigot') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `Spigot codegen supports Minecraft 1.21 / 1.21.1 / 1.21.4 only. ${minecraftVersion} is not pinned.`,
      action: 'Create a Spigot 1.21 / 1.21.1 / 1.21.4 project. Paper success is not Spigot compatibility.'
    })
  }
  if (platform === 'forge') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `Forge codegen supports Minecraft 1.21.1 only. ${minecraftVersion} is not pinned.`,
      action: 'Create a Forge 1.21.1 project. NeoForge success is not Forge compatibility.'
    })
  }
  throw new AppError({
    code: 'ADAPTER_UNSUPPORTED',
    message: `${platform} + Minecraft ${minecraftVersion} has no Phase 5 emitter.`,
    action: 'Use Fabric 1.21.x, Paper 1.21.x, NeoForge 1.21.1/1.21.4/1.21.8, Forge 1.21.1, or Spigot 1.21/1.21.1/1.21.4.'
  })
}

export function assertSpecCapabilities(manifest: ProjectManifest, spec: ProjectSpec): void {
  if (spec.worldgen.length > 0 && (manifest.platform === 'paper' || manifest.platform === 'spigot')) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `${manifest.platform} cannot emit worldgen ore features.`,
      action: 'Remove worldgen entries or use Fabric / Forge / NeoForge. Paper/Spigot stay honest: no fake worldgen.'
    })
  }
}

export function planAdapterFiles(manifest: ProjectManifest, spec: ProjectSpec): PlannedFile[] {
  assertCanGenerate(manifest.platform, manifest.minecraftVersion)
  assertSpecCapabilities(manifest, spec)
  if (manifest.platform === 'fabric') {
    return planFabricFiles(manifest, spec)
  }
  if (manifest.platform === 'paper') {
    return planPaperFiles(manifest, spec)
  }
  if (manifest.platform === 'neoforge') {
    return planNeoForgeFiles(manifest, spec)
  }
  if (manifest.platform === 'forge') {
    return planForgeFiles(manifest, spec)
  }
  if (manifest.platform === 'spigot') {
    return planSpigotFiles(manifest, spec)
  }
  throw new AppError({
    code: 'ADAPTER_UNSUPPORTED',
    message: `${manifest.platform} generation is not implemented.`,
    action: 'Use Fabric, Paper, NeoForge, Forge 1.21.1, or Spigot 1.21.x (not 1.21.8).'
  })
}
