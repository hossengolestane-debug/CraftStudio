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
    gradle: '8.11.1',
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
    java: 21
  },
  '1.21.1': {
    minecraft: '1.21.1',
    paperApi: '1.21.1-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21
  },
  '1.21.4': {
    minecraft: '1.21.4',
    paperApi: '1.21.4-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21
  },
  '1.21.8': {
    minecraft: '1.21.8',
    paperApi: '1.21.8-R0.1-SNAPSHOT',
    apiVersion: '1.21',
    gradle: '8.11.1',
    java: 21
  }
}

export const FABRIC_CODEGEN_VERSIONS = Object.keys(FABRIC_PINS)
export const PAPER_CODEGEN_VERSIONS = Object.keys(PAPER_PINS)

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

export function isCodegenSupported(platform: PlatformId, minecraftVersion: string): boolean {
  if (platform === 'fabric') {
    return minecraftVersion in FABRIC_PINS
  }
  if (platform === 'paper') {
    return minecraftVersion in PAPER_PINS
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
  return 21
}
