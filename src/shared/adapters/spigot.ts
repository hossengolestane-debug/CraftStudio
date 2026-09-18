import type { PlatformAdapter } from '../types'

export const SpigotAdapter: PlatformAdapter = {
  id: 'spigot',
  displayName: 'Spigot',
  kind: 'plugin',
  supportedVersions: ['1.18.2', '1.19.4', '1.20.1', '1.20.4', '1.20.6', '1.21', '1.21.1', '1.21.4'],
  capabilities: {
    customItems: 'limited',
    customBlocks: 'unsupported',
    customEntities: 'limited',
    clientEntities: 'unsupported',
    customGuis: 'limited',
    recipes: 'limited',
    worldgen: 'unsupported',
    serverCommands: 'supported',
    textures: 'unsupported',
    gradleProject: 'unsupported'
  },
  javaRequirements: {
    minVersion: 17,
    recommendedVersion: 21,
    notes: 'Spigot 1.18–1.20.4 typically needs Java 17; 1.21+ needs Java 21. Spigot APIs trail Paper on some newer versions.'
  },
  templates: [
    {
      id: 'spigot-gradle-stub',
      displayName: 'Spigot plugin Gradle project',
      description: 'Real Gradle emission is not implemented in Phase 1.',
      status: 'stub'
    }
  ],
  validationRules: [
    {
      id: 'spigot-plugin-name',
      description: 'Future plugin.yml name must be unique and non-empty.',
      severity: 'error'
    },
    {
      id: 'spigot-client-entities',
      description: 'Plugins cannot register arbitrary new client-side entities or custom block models.',
      severity: 'error'
    }
  ],
  testProcedures: [
    {
      id: 'spigot-server-run',
      displayName: 'Start a local Spigot server',
      description: 'Not implemented. A later phase would build Spigot via BuildTools — that is out of Phase 1 scope.',
      status: 'stub'
    }
  ]
}
