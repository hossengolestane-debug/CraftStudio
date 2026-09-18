import type { PlatformAdapter } from '../types'

export const FabricAdapter: PlatformAdapter = {
  id: 'fabric',
  displayName: 'Fabric',
  kind: 'mod',
  supportedVersions: ['1.18.2', '1.19.4', '1.20.1', '1.20.4', '1.20.6', '1.21', '1.21.1', '1.21.2', '1.21.4', '1.21.8'],
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
    notes: 'Java 17 for 1.18–1.20.4; Java 21 recommended for 1.20.5+ and required for 1.21+.'
  },
  templates: [
    {
      id: 'fabric-item-gradle',
      displayName: 'Fabric Gradle + custom item',
      description:
        'Trusted Loom/Yarn templates for Minecraft 1.21, 1.21.1, 1.21.2, 1.21.4, and 1.21.8. Classic Registry.register on 1.21/1.21.1; Items.register + RegistryKey from 1.21.2.',
      status: 'available'
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
      id: 'fabric-gradle-build',
      displayName: 'Gradle build',
      description: 'Runs `./gradlew build` for supported Fabric 1.21.x pins. Compile success is not a Tested row.',
      status: 'available'
    },
    {
      id: 'fabric-client-run',
      displayName: 'Run client via Gradle',
      description:
        'Optional `./gradlew runClient` after explicit Minecraft EULA acceptance. Downloads game files through official Gradle/Minecraft channels; never silently accepted. Not marked Tested without a verified client run.',
      status: 'available'
    }
  ]
}
