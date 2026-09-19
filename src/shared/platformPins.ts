import { AppError } from './errors'
import type { PlatformId } from './types'

export type FabricItemRegistration = 'classic' | 'registry_key'

export interface FabricVersionPins {
  minecraft: string
  yarn: string
  loader: string
  loom: string
  fabricApi: string
  gradle: string
  java: number
  itemRegistration: FabricItemRegistration
}

export interface PaperVersionPins {
  minecraft: string
  paperApi: string
  apiVersion: string
  gradle: string
  java: number
  itemModel: 'predicate' | 'range_dispatch'
}

export type NeoForgeEntityTypeBuild = 'legacy_string' | 'resource_key'

export interface NeoForgeVersionPins {
  minecraft: string
  neoVersion: string
  minecraftVersionRange: string
  loaderVersionRange: string
  moddev: string
  gradle: string
  java: number
  entityRegistration: boolean
  entityTypeBuild: NeoForgeEntityTypeBuild
}

export interface ForgeVersionPins {
  minecraft: string
  forgeVersion: string
  minecraftVersionRange: string
  forgeVersionRange: string
  loaderVersionRange: string
  forgeGradle: string
  mappingChannel: string
  mappingVersion: string
  gradle: string
  java: number
}

export interface SpigotVersionPins {
  minecraft: string
  spigotApi: string
  apiVersion: string
  gradle: string
  java: number
}

/**
 * Pins from fabricmc.net/develop / Fabric Meta (Yarn + Loader) and Fabric API Maven.
 * Classic Registry.register for 1.21 / 1.21.1; Items.register + RegistryKey from 1.21.2.
 */
export const FABRIC_PINS: Record<string, FabricVersionPins> = {
  '1.21': {
    minecraft: '1.21',
    yarn: '1.21+build.9',
    loader: '0.16.10',
    loom: '1.9.2',
    fabricApi: '0.102.0+1.21',
    gradle: '8.11.1',
    java: 21,
    itemRegistration: 'classic'
  },
  '1.21.1': {
    minecraft: '1.21.1',
    yarn: '1.21.1+build.3',
    loader: '0.16.10',
    loom: '1.9.2',
    fabricApi: '0.115.6+1.21.1',
    gradle: '8.11.1',
    java: 21,
    itemRegistration: 'classic'
  },
  '1.21.2': {
    minecraft: '1.21.2',
    yarn: '1.21.2+build.1',
    loader: '0.16.10',
    loom: '1.9.2',
    fabricApi: '0.106.1+1.21.2',
    gradle: '8.11.1',
    java: 21,
    itemRegistration: 'registry_key'
  },
  '1.21.4': {
    minecraft: '1.21.4',
    yarn: '1.21.4+build.8',
    loader: '0.16.10',
    loom: '1.9.2',
    fabricApi: '0.119.4+1.21.4',
    gradle: '8.11.1',
    java: 21,
    itemRegistration: 'registry_key'
  },
  '1.21.8': {
    minecraft: '1.21.8',
    yarn: '1.21.8+build.1',
    loader: '0.16.14',
    loom: '1.10.1',
    fabricApi: '0.136.1+1.21.8',
    gradle: '8.12.1',
    java: 21,
    itemRegistration: 'registry_key'
  }
}

export const PAPER_PINS: Record<string, PaperVersionPins> = {
  '1.21': {
    minecraft: '1.21',
    paperApi: '1.21-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21,
    itemModel: 'predicate'
  },
  '1.21.1': {
    minecraft: '1.21.1',
    paperApi: '1.21.1-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21,
    itemModel: 'predicate'
  },
  '1.21.4': {
    minecraft: '1.21.4',
    paperApi: '1.21.4-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21,
    itemModel: 'range_dispatch'
  },
  '1.21.8': {
    minecraft: '1.21.8',
    paperApi: '1.21.8-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21,
    itemModel: 'range_dispatch'
  }
}

/**
 * Pins from maven.neoforged.net (NeoForge 21.1.250, ModDevGradle 2.0.147).
 * One Experimental 1.21.x mapping — not a Forge claim.
 */
export const NEOFORGE_PINS: Record<string, NeoForgeVersionPins> = {
  '1.21.1': {
    minecraft: '1.21.1',
    neoVersion: '21.1.250',
    minecraftVersionRange: '[1.21.1]',
    loaderVersionRange: '[4,)',
    moddev: '2.0.147',
    gradle: '8.11.1',
    java: 21,
    entityRegistration: true,
    entityTypeBuild: 'legacy_string'
  },
  '1.21.4': {
    minecraft: '1.21.4',
    neoVersion: '21.4.157',
    minecraftVersionRange: '[1.21.4]',
    loaderVersionRange: '[4,)',
    moddev: '2.0.147',
    gradle: '8.11.1',
    java: 21,
    entityRegistration: true,
    entityTypeBuild: 'resource_key'
  },
  '1.21.8': {
    minecraft: '1.21.8',
    neoVersion: '21.8.54',
    minecraftVersionRange: '[1.21.8]',
    loaderVersionRange: '[4,)',
    moddev: '2.0.147',
    gradle: '8.11.1',
    java: 21,
    entityRegistration: true,
    entityTypeBuild: 'resource_key'
  }
}

/**
 * Pins from maven.minecraftforge.net — Forge 1.21.1-52.1.16 + ForgeGradle 6.0.36.
 * Not inferred from NeoForge.
 */
export const FORGE_PINS: Record<string, ForgeVersionPins> = {
  '1.21.1': {
    minecraft: '1.21.1',
    forgeVersion: '52.1.16',
    minecraftVersionRange: '[1.21.1,1.21.2)',
    forgeVersionRange: '[52.1.16,)',
    loaderVersionRange: '[52,)',
    forgeGradle: '6.0.36',
    mappingChannel: 'official',
    mappingVersion: '1.21.1',
    gradle: '8.11.1',
    java: 21
  }
}

export const SPIGOT_PINS: Record<string, SpigotVersionPins> = {
  '1.21': {
    minecraft: '1.21',
    spigotApi: '1.21-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21
  },
  '1.21.1': {
    minecraft: '1.21.1',
    spigotApi: '1.21.1-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21
  },
  '1.21.4': {
    minecraft: '1.21.4',
    spigotApi: '1.21.4-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21
  }
}

export const PACK_FORMAT: Record<string, number> = {
  '1.21': 34,
  '1.21.1': 34,
  '1.21.2': 42,
  '1.21.4': 46,
  '1.21.8': 64
}

export const DATA_PACK_FORMAT: Record<string, number> = {
  '1.21': 48,
  '1.21.1': 48,
  '1.21.2': 57,
  '1.21.4': 61,
  '1.21.8': 81
}

export const FABRIC_CODEGEN_VERSIONS = Object.keys(FABRIC_PINS)
export const PAPER_CODEGEN_VERSIONS = Object.keys(PAPER_PINS)
export const NEOFORGE_CODEGEN_VERSIONS = Object.keys(NEOFORGE_PINS)
export const FORGE_CODEGEN_VERSIONS = Object.keys(FORGE_PINS)
export const SPIGOT_CODEGEN_VERSIONS = Object.keys(SPIGOT_PINS)

export function fabricPinsFor(minecraftVersion: string): FabricVersionPins {
  const pins = FABRIC_PINS[minecraftVersion]
  if (!pins) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `Fabric codegen supports Minecraft ${FABRIC_CODEGEN_VERSIONS.join(', ')} only.`,
      action: `Recreate the project on ${FABRIC_CODEGEN_VERSIONS.join(' or ')}. Other 1.21.x rows stay Experimental without an emitter.`,
      details: `Requested ${minecraftVersion}`
    })
  }
  return pins
}

export function paperPinsFor(minecraftVersion: string): PaperVersionPins {
  const pins = PAPER_PINS[minecraftVersion]
  if (!pins) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `Paper codegen supports Minecraft ${PAPER_CODEGEN_VERSIONS.join(', ')} only.`,
      action: `Create a Paper ${PAPER_CODEGEN_VERSIONS.join(' / ')} project. Spigot is a separate stub.`,
      details: `Requested ${minecraftVersion}`
    })
  }
  return pins
}

export function neoforgePinsFor(minecraftVersion: string): NeoForgeVersionPins {
  const pins = NEOFORGE_PINS[minecraftVersion]
  if (!pins) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `NeoForge codegen supports Minecraft ${NEOFORGE_CODEGEN_VERSIONS.join(', ')} only.`,
      action: `Create a NeoForge ${NEOFORGE_CODEGEN_VERSIONS.join(' / ')} project. Forge is a separate adapter.`,
      details: `Requested ${minecraftVersion}`
    })
  }
  return pins
}

export function forgePinsFor(minecraftVersion: string): ForgeVersionPins {
  const pins = FORGE_PINS[minecraftVersion]
  if (!pins) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `Forge codegen supports Minecraft ${FORGE_CODEGEN_VERSIONS.join(', ')} only.`,
      action: 'Create a Forge 1.21.1 project. NeoForge success is not Forge compatibility.',
      details: `Requested ${minecraftVersion}`
    })
  }
  return pins
}

export function spigotPinsFor(minecraftVersion: string): SpigotVersionPins {
  const pins = SPIGOT_PINS[minecraftVersion]
  if (!pins) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `Spigot codegen supports Minecraft ${SPIGOT_CODEGEN_VERSIONS.join(', ')} only.`,
      action: 'Create a Spigot 1.21 / 1.21.1 / 1.21.4 project. Paper success is not Spigot compatibility.',
      details: `Requested ${minecraftVersion}`
    })
  }
  return pins
}

export function packFormatFor(minecraftVersion: string): number {
  const format = PACK_FORMAT[minecraftVersion]
  if (!format) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `No pack_format pin for Minecraft ${minecraftVersion}.`,
      action: 'Export a resource pack for a supported 1.21.x version.'
    })
  }
  return format
}

export function dataPackFormatFor(minecraftVersion: string): number {
  const format = DATA_PACK_FORMAT[minecraftVersion]
  if (!format) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `No datapack pack_format pin for Minecraft ${minecraftVersion}.`,
      action: 'Export a datapack for a supported 1.21.x version.'
    })
  }
  return format
}

export function isCodegenSupported(platform: PlatformId, minecraftVersion: string): boolean {
  if (platform === 'fabric') {
    return minecraftVersion in FABRIC_PINS
  }
  if (platform === 'paper') {
    return minecraftVersion in PAPER_PINS
  }
  if (platform === 'neoforge') {
    return minecraftVersion in NEOFORGE_PINS
  }
  if (platform === 'forge') {
    return minecraftVersion in FORGE_PINS
  }
  if (platform === 'spigot') {
    return minecraftVersion in SPIGOT_PINS
  }
  return false
}

export function requiredJava(platform: PlatformId, minecraftVersion: string): number {
  if (platform === 'fabric') {
    return fabricPinsFor(minecraftVersion).java
  }
  if (platform === 'paper') {
    return paperPinsFor(minecraftVersion).java
  }
  if (platform === 'neoforge') {
    return neoforgePinsFor(minecraftVersion).java
  }
  if (platform === 'forge') {
    return forgePinsFor(minecraftVersion).java
  }
  if (platform === 'spigot') {
    return spigotPinsFor(minecraftVersion).java
  }
  return 21
}

export function customModelDataFor(itemIndex: number): number {
  return itemIndex + 1
}
