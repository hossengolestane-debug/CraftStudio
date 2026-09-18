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
    biomeSpawns: 'unsupported',
    serverCommands: 'supported',
    textures: 'limited',
    gradleProject: 'supported'
  },
  javaRequirements: {
    minVersion: 17,
    recommendedVersion: 21,
    notes: 'Paper 1.18–1.20.4 typically needs Java 17; 1.20.5+ and 1.21+ need Java 21.'
  },
  templates: [
    {
      id: 'paper-item-gradle',
      displayName: 'Paper Gradle + PDC item',
      description:
        'Trusted Java plugin + plugin.yml for Paper 1.21 / 1.21.1 / 1.21.4 / 1.21.8. Custom items are vanilla paper + PDC + CustomModelData. Clients must install the exported resource pack. Not valid on Spigot.',
      status: 'available'
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
      id: 'paper-gradle-build',
      displayName: 'Gradle build',
      description: 'Runs `./gradlew build` against paper-api. Compile success is not a Tested row.',
      status: 'available'
    },
    {
      id: 'paper-server-run',
      displayName: 'Paper test-server prep',
      description:
        'Writes run-paper/ notes and eula=false. Does not download Paper or Minecraft, does not launch a server, and does not accept the EULA.',
      status: 'available'
    }
  ]
}
