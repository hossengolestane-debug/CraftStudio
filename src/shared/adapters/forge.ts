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
    gradleProject: 'supported'
  },
  javaRequirements: {
    minVersion: 17,
    recommendedVersion: 21,
    notes: 'Java 17 for 1.18–1.20.4; Java 21 for 1.21+. Phase 6 emits ForgeGradle only for 1.21.1 (items, preset mobs, container menu). NeoForge is a separate adapter.'
  },
  templates: [
    {
      id: 'forge-item-gradle',
      displayName: 'Forge Gradle + custom item',
      description:
        'Trusted ForgeGradle 6 templates for Minecraft 1.21.1 (Forge 52.1.16, official mappings). Not inferred from NeoForge. Preset entities and a container/menu pair are included when the spec has those fields.',
      status: 'available'
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
      description:
        'Runs `./gradlew build` for Forge 1.21.1. Compile success is not a Tested row and is not NeoForge compatibility.',
      status: 'available'
    }
  ]
}
