import { AppError } from '../../../shared/errors'

export interface FabricVersionPins {
  minecraft: string
  yarn: string
  loader: string
  loom: string
  fabricApi: string
  gradle: string
  java: number
}

const PINS: Record<string, FabricVersionPins> = {
  '1.21': {
    minecraft: '1.21',
    yarn: '1.21+build.9',
    loader: '0.16.10',
    loom: '1.9.2',
    fabricApi: '0.102.0+1.21',
    gradle: '8.11.1',
    java: 21
  },
  '1.21.1': {
    minecraft: '1.21.1',
    yarn: '1.21.1+build.3',
    loader: '0.16.10',
    loom: '1.9.2',
    fabricApi: '0.115.6+1.21.1',
    gradle: '8.11.1',
    java: 21
  }
}

export const FABRIC_CODEGEN_VERSIONS = Object.keys(PINS)

export function fabricPinsFor(minecraftVersion: string): FabricVersionPins {
  const pins = PINS[minecraftVersion]
  if (!pins) {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: `Phase 2 Fabric codegen supports Minecraft ${FABRIC_CODEGEN_VERSIONS.join(' and ')} only.`,
      action: `Recreate the project on ${FABRIC_CODEGEN_VERSIONS.join(' or ')}, or wait for a later phase.`,
      details: `Requested ${minecraftVersion}`
    })
  }
  return pins
}
