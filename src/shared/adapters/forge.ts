import type { PlatformAdapter } from '../types'

export const ForgeAdapter: PlatformAdapter = {
  id: 'forge',
  displayName: 'Forge',
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
    notes: 'Java 17 for 1.18–1.20.4; Java 21 for 1.21+. Confirm the official Forge MDK for the chosen version before generating a project later.'
  },
  templates: [
    {
      id: 'forge-gradle-stub',
      displayName: 'Forge Gradle project',
      description: 'Real Gradle emission is not implemented in Phase 1.',
      status: 'stub'
    }
  ],
  validationRules: [
    {
      id: 'forge-modid',
      description: 'Future generated mod id must be lowercase [a-z0-9_].',
      severity: 'error'
    }
  ],
  testProcedures: [
    {
      id: 'forge-client-run',
      displayName: 'Run client via Gradle',
      description: 'Not implemented. Phase 3+ will invoke the Forge runClient task.',
      status: 'stub'
    }
  ]
}
