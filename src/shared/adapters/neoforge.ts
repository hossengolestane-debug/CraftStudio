import type { PlatformAdapter } from '../types'

export const NeoForgeAdapter: PlatformAdapter = {
  id: 'neoforge',
  displayName: 'NeoForge',
  kind: 'mod',
  supportedVersions: ['1.20.4', '1.20.6', '1.21', '1.21.1', '1.21.4', '1.21.8'],
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
    notes: 'NeoForge 1.20.4 typically needs Java 17; 1.20.5+ and 1.21+ need Java 21. NeoForge does not exist for 1.20.1 or earlier.'
  },
  templates: [
    {
      id: 'neoforge-gradle-stub',
      displayName: 'NeoForge Gradle project',
      description: 'Real Gradle emission is not implemented in Phase 1.',
      status: 'stub'
    }
  ],
  validationRules: [
    {
      id: 'neoforge-modid',
      description: 'Future generated mod id must be lowercase [a-z0-9_].',
      severity: 'error'
    },
    {
      id: 'neoforge-floor',
      description: 'Reject Minecraft versions before 1.20.2 — NeoForge did not exist.',
      severity: 'error'
    }
  ],
  testProcedures: [
    {
      id: 'neoforge-client-run',
      displayName: 'Run client via Gradle',
      description: 'Not implemented. Phase 3+ will invoke the NeoForge runClient task.',
      status: 'stub'
    }
  ]
}
