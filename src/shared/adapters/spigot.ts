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
    textures: 'limited',
    gradleProject: 'supported'
  },
  javaRequirements: {
    minVersion: 17,
    recommendedVersion: 21,
    notes: 'Spigot 1.18–1.20.4 typically needs Java 17; 1.21+ needs Java 21. Spigot APIs trail Paper on some newer versions.'
  },
  templates: [
    {
      id: 'spigot-item-gradle',
      displayName: 'Spigot Gradle + PDC item',
      description:
        'Trusted Java plugin + plugin.yml for Spigot 1.21 / 1.21.1 / 1.21.4 using org.spigotmc:spigot-api only. Not copied from Paper. Custom items are vanilla paper + PDC. Custom mobs are vanilla disguises. 1.21.8 is unsupported.',
      status: 'available'
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
      description:
        'Runs `./gradlew build` against spigot-api. Compile success is not a Tested row. Paper success is not Spigot compatibility.',
      status: 'available'
    }
  ]
}
