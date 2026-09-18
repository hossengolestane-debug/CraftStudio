import type { PlatformAdapter } from '../types'

export const FabricAdapter: PlatformAdapter = {
  id: 'fabric',
  displayName: 'Fabric',
  kind: 'mod',
  supportedVersions: ['1.18.2', '1.19.4', '1.20.1', '1.20.4', '1.20.6', '1.21', '1.21.1', '1.21.4', '1.21.8'],
  capabilities: {
    customItems: 'supported',
    customBlocks: 'supported',
    customEntities: 'supported',
    clientEntities: 'supported',
    customGuis: 'supported',
    recipes: 'supported',
    worldgen: 'supported',
    serverCommands: 'supported',
    textures: 'supported',
    gradleProject: 'unsupported'
  },
  javaRequirements: {
    minVersion: 17,
    recommendedVersion: 21,
    notes: 'Java 17 for 1.18–1.20.4; Java 21 recommended for 1.20.5+ and required for 1.21+.'
  },
  templates: [
    {
      id: 'fabric-gradle-stub',
      displayName: 'Fabric Gradle project',
      description: 'Real Gradle emission is not implemented in Phase 1.',
      status: 'stub'
    }
  ],
  validationRules: [
    {
      id: 'fabric-modid',
      description: 'Future generated mod id must be lowercase [a-z0-9_].',
      severity: 'error'
    },
    {
      id: 'fabric-api',
      description: 'Fabric API version must match the selected Minecraft version when generation lands.',
      severity: 'warning'
    }
  ],
  testProcedures: [
    {
      id: 'fabric-client-run',
      displayName: 'Run client via Gradle',
      description: 'Not implemented. Phase 3+ will invoke the Fabric runClient task.',
      status: 'stub'
    }
  ]
}
