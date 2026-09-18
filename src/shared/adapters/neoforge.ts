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
    biomeSpawns: 'limited',
    serverCommands: 'supported',
    textures: 'supported',
    gradleProject: 'supported'
  },
  javaRequirements: {
    minVersion: 17,
    recommendedVersion: 21,
    notes: 'NeoForge 1.20.4 typically needs Java 17; 1.20.5+ and 1.21+ need Java 21. NeoForge does not exist for 1.20.1 or earlier.'
  },
  templates: [
    {
      id: 'neoforge-item-gradle',
      displayName: 'NeoForge Gradle + custom item',
      description:
        'Trusted ModDevGradle templates for Minecraft 1.21.1 (NeoForge 21.1.250), 1.21.4 (21.4.157), and 1.21.8 (21.8.54). Preset entity registration and a container/menu pair are emitted on those pins. Forge is a separate adapter and is not inferred from this slice.',
      status: 'available'
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
      id: 'neoforge-gradle-build',
      displayName: 'Gradle build',
      description: 'Runs `./gradlew build` for NeoForge 1.21.1 / 1.21.4 / 1.21.8. Compile success is not a Tested row and is not Forge compatibility.',
      status: 'available'
    },
    {
      id: 'neoforge-client-run',
      displayName: 'Run client via Gradle',
      description:
        'Optional `./gradlew runClient` after explicit Minecraft EULA acceptance. Not marked Tested without a verified client run. Not a Forge claim.',
      status: 'available'
    }
  ]
}
