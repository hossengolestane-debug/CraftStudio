import { AppError } from '../../../shared/errors'
import { neoforgePinsFor } from '../../../shared/platformPins'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import type { ProjectManifest } from '../../../shared/types'
import type { PlannedFile } from '../types'
import { gradleWrapperFiles, javaEscape } from '../wrapper'

function itemRegistrations(spec: ProjectSpec): string {
  return spec.items
    .map((item) => {
      const constant = toConstName(item.id)
      return `  public static final DeferredItem<Item> ${constant} = ITEMS.registerSimpleItem(
    "${item.id}",
    new Item.Properties().stacksTo(${item.maxCount})
  );`
    })
    .join('\n\n')
}

function creativeAccepts(spec: ProjectSpec): string {
  return spec.items.map((item) => `      event.accept(${toConstName(item.id)});`).join('\n')
}

function mainJava(spec: ProjectSpec): string {
  return `package ${spec.packageName};

import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.event.BuildCreativeModeTabContentsEvent;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

@Mod(${spec.mainClass}.MOD_ID)
public class ${spec.mainClass} {
  public static final String MOD_ID = "${javaEscape(spec.modId)}";
  public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(MOD_ID);

${itemRegistrations(spec)}

  public ${spec.mainClass}(IEventBus modEventBus) {
    ITEMS.register(modEventBus);
    modEventBus.addListener(this::addCreative);
  }

  private void addCreative(BuildCreativeModeTabContentsEvent event) {
    if (event.getTabKey() == CreativeModeTabs.INGREDIENTS) {
${creativeAccepts(spec)}
    }
  }
}
`
}

function propsEscape(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\\/g, '\\\\')
}

export function planNeoForgeFiles(manifest: ProjectManifest, spec: ProjectSpec): PlannedFile[] {
  if (manifest.platform !== 'neoforge' || manifest.type !== 'mod') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: 'This emitter only generates Gradle projects for NeoForge mods.',
      action: 'Create a NeoForge 1.21.1 project. Forge is a separate stub and is not inferred from NeoForge.'
    })
  }

  const pins = neoforgePinsFor(manifest.minecraftVersion)
  const packagePath = spec.packageName.replace(/\./g, '/')
  const files: PlannedFile[] = []

  files.push({
    relativePath: 'gradle.properties',
    encoding: 'utf8',
    contents: [
      'org.gradle.jvmargs=-Xmx1G',
      'org.gradle.parallel=true',
      '',
      '# Versions from maven.neoforged.net — CraftStudio pins (not model-chosen).',
      '# This is NeoForge. It is not a Forge compatibility claim.',
      `minecraft_version=${pins.minecraft}`,
      `minecraft_version_range=${pins.minecraftVersionRange}`,
      `neo_version=${pins.neoVersion}`,
      `loader_version_range=${pins.loaderVersionRange}`,
      '',
      `mod_id=${spec.modId}`,
      `mod_name=${propsEscape(spec.displayName)}`,
      'mod_license=MIT',
      'mod_version=1.0.0',
      `mod_group_id=${spec.packageName}`,
      'mod_authors=CraftStudio Local',
      `mod_description=${propsEscape(spec.description || spec.displayName)}`,
      ''
    ].join('\n')
  })

  files.push({
    relativePath: 'settings.gradle',
    encoding: 'utf8',
    contents: `pluginManagement {
  repositories {
    gradlePluginPortal()
    maven { name = 'NeoForged'; url = 'https://maven.neoforged.net/releases' }
  }
}

rootProject.name = '${spec.modId}'
`
  })

  files.push({
    relativePath: 'build.gradle',
    encoding: 'utf8',
    contents: `plugins {
  id 'java-library'
  id 'net.neoforged.moddev' version '${pins.moddev}'
}

version = project.mod_version
group = project.mod_group_id

base {
  archivesName = project.mod_id
}

java.toolchain.languageVersion = JavaLanguageVersion.of(${pins.java})

neoForge {
  version = project.neo_version

  runs {
    client {
      client()
    }
    server {
      server()
      programArgument '--nogui'
    }
  }

  mods {
    "\${mod_id}" {
      sourceSet sourceSets.main
    }
  }
}

repositories {
}

dependencies {
}

tasks.withType(JavaCompile).configureEach {
  options.encoding = 'UTF-8'
  options.release = ${pins.java}
}

tasks.named('processResources', ProcessResources).configure {
  var replaceProperties = [
    minecraft_version      : minecraft_version,
    minecraft_version_range: minecraft_version_range,
    neo_version            : neo_version,
    loader_version_range   : loader_version_range,
    mod_id                 : mod_id,
    mod_name               : mod_name,
    mod_license            : mod_license,
    mod_version            : mod_version,
    mod_authors            : mod_authors,
    mod_description        : mod_description
  ]
  inputs.properties replaceProperties
  filesMatching(['META-INF/neoforge.mods.toml']) {
    expand replaceProperties
  }
}

jar {
  archiveBaseName = project.mod_id
}
`
  })

  files.push(...gradleWrapperFiles(pins.gradle))

  files.push({
    relativePath: '.gitignore',
    encoding: 'utf8',
    contents: ['.gradle/', 'build/', 'run/', 'out/', '*.iml', '.idea/', '\n'].join('\n')
  })

  files.push({
    relativePath: 'src/main/resources/META-INF/neoforge.mods.toml',
    encoding: 'utf8',
    contents: [
      'modLoader="javafml"',
      'loaderVersion="${loader_version_range}"',
      'license="${mod_license}"',
      '',
      '[[mods]]',
      'modId="${mod_id}"',
      'version="${mod_version}"',
      'displayName="${mod_name}"',
      'authors="${mod_authors}"',
      "description='''${mod_description}'''",
      '',
      '[[dependencies.${mod_id}]]',
      'modId="neoforge"',
      'type="required"',
      'versionRange="[${neo_version},)"',
      'ordering="NONE"',
      'side="BOTH"',
      '',
      '[[dependencies.${mod_id}]]',
      'modId="minecraft"',
      'type="required"',
      'versionRange="${minecraft_version_range}"',
      'ordering="NONE"',
      'side="BOTH"',
      ''
    ].join('\n')
  })

  const lang: Record<string, string> = {
    [`itemGroup.${spec.modId}`]: spec.displayName
  }
  for (const item of spec.items) {
    lang[`item.${spec.modId}.${item.id}`] = item.displayName
  }
  files.push({
    relativePath: `src/main/resources/assets/${spec.modId}/lang/en_us.json`,
    encoding: 'utf8',
    contents: `${JSON.stringify(lang, null, 2)}\n`
  })

  for (const item of spec.items) {
    files.push({
      relativePath: `src/main/resources/assets/${spec.modId}/models/item/${item.id}.json`,
      encoding: 'utf8',
      contents: `${JSON.stringify(
        {
          parent: 'minecraft:item/generated',
          textures: {
            layer0: 'minecraft:item/flint'
          }
        },
        null,
        2
      )}\n`
    })
  }

  files.push({
    relativePath: `src/main/java/${packagePath}/${spec.mainClass}.java`,
    encoding: 'utf8',
    contents: mainJava(spec)
  })

  files.push({
    relativePath: 'INSTALL.md',
    encoding: 'utf8',
    contents: [
      `# Install ${spec.displayName}`,
      '',
      `NeoForge ${pins.minecraft} · NeoForge ${pins.neoVersion} · Java ${pins.java}`,
      '',
      'This project is **NeoForge only**. It is not a Forge mod and must not be installed on Forge.',
      '',
      '1. Install the Minecraft launcher and this exact game version.',
      '2. Install the [NeoForge](https://neoforged.net/) installer for that version.',
      '3. Build with `./gradlew build`, then copy `build/libs/' +
        spec.modId +
        '-1.0.0.jar` into `.minecraft/mods`.',
      '4. Accept the Minecraft EULA yourself. CraftStudio never distributes game files or bypasses auth.',
      '',
      '`./gradlew runClient` is optional developer wiring. A successful compile is **not** a Tested compatibility row.',
      ''
    ].join('\n')
  })

  files.push({
    relativePath: 'README.md',
    encoding: 'utf8',
    contents: [
      `# ${spec.displayName}`,
      '',
      spec.description || '_No description._',
      '',
      `Generated by CraftStudio Local for **NeoForge ${pins.minecraft}** (NeoForge ${pins.neoVersion}, ModDevGradle ${pins.moddev}).`,
      'Build files come from trusted templates. The model never writes Gradle or Java directly.',
      '**Not Forge.** Do not treat this as Forge compatibility.',
      '',
      '## Build',
      '',
      'Requires Java ' + pins.java + '.',
      '',
      '```bash',
      './gradlew build',
      '```',
      '',
      'Optional (after you accept Minecraft terms in the app): `./gradlew runClient`.',
      'See INSTALL.md. Compatibility stays Experimental until a real client run is recorded as evidence.',
      ''
    ].join('\n')
  })

  return files
}
