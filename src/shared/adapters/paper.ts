import type { PlatformAdapter } from '../types'

export const PaperAdapter: PlatformAdapter = {
  id: 'paper',
  displayName: 'Paper',
  kind: 'plugin',
  supportedVersions: ['1.18.2', '1.19.4', '1.20.1', '1.20.4', '1.20.6', '1.21', '1.21.1', '1.21.4', '1.21.8'],
  capabilities: {
    customItems: 'limited',
    customBlocks: 'unsupported',
    customEntities: 'limited',
    clientEntities: 'unsupported',
    customGuis: 'limited',
    recipes: 'limited',
    worldgen: 'limited',
    serverCommands: 'supported',
    textures: 'unsupported',
    gradleProject: 'unsupported'
  },
  javaRequirements: {
    minVersion: 17,
    recommendedVersion: 21,
    notes: 'Paper 1.18–1.20.4 typically needs Java 17; 1.20.5+ and 1.21+ need Java 21.'
  },
  templates: [
    {
      id: 'paper-gradle-stub',
      displayName: 'Paper plugin Gradle project',
      description: 'Real Gradle emission is not implemented in Phase 1.',
      status: 'stub'
    }
  ],
  validationRules: [
    {
      id: 'paper-plugin-name',
      description: 'Future plugin.yml name must be unique and non-empty.',
      severity: 'error'
    },
    {
      id: 'paper-client-entities',
      description: 'Plugins cannot register arbitrary new client-side entities. Players only see vanilla (or resource-pack) models.',
      severity: 'error'
    }
  ],
  testProcedures: [
    {
      id: 'paper-server-run',
      displayName: 'Start a local Paper server',
      description: 'Not implemented. A later phase will download a Paper build and copy the plugin jar.',
      status: 'stub'
    }
  ]
}
