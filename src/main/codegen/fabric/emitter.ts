import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AppError } from '../../../shared/errors'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import type { ProjectManifest } from '../../../shared/types'
import { fabricPinsFor } from './versions'

export interface PlannedFile {
  relativePath: string
  contents: string | Buffer
  encoding: 'utf8' | 'binary'
}

function wrapperAsset(name: string): Buffer {
  const here = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, 'wrapper', name),
    join(here, '../../../src/main/codegen/fabric/wrapper', name),
    join(process.cwd(), 'src/main/codegen/fabric/wrapper', name)
  ]
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate)
    } catch {
      // try next
    }
  }
  throw new AppError({
    code: 'IO',
    message: `Missing vendored Gradle wrapper file "${name}".`,
    action: 'Reinstall the app sources so src/main/codegen/fabric/wrapper is present.'
  })
}

function javaEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function itemJava(spec: ProjectSpec): string {
  return spec.items
    .map((item) => {
      const constant = toConstName(item.id)
      return `  public static final Item ${constant} = Registry.register(
    Registries.ITEM,
    Identifier.of(MOD_ID, "${item.id}"),
    new Item(new Item.Settings().maxCount(${item.maxCount}))
  );`
    })
    .join('\n\n')
}

function itemAdds(spec: ProjectSpec): string {
  return spec.items.map((item) => `      entries.add(${toConstName(item.id)});`).join('\n')
}

function commandComments(spec: ProjectSpec): string {
  if (spec.commands.length === 0) {
    return ''
  }
  return spec.commands
    .map(
      (command) =>
        `    // Command /${command.name} is recorded in the spec only. Fabric command registration is not generated in Phase 2.`
    )
    .join('\n')
}

export function planFabricFiles(manifest: ProjectManifest, spec: ProjectSpec): PlannedFile[] {
  if (manifest.platform !== 'fabric' || manifest.type !== 'mod') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: 'Phase 2 only generates Gradle projects for Fabric mods.',
      action: 'Create a Fabric 1.21 or 1.21.1 project, or wait for another adapter.'
    })
  }

  const pins = fabricPinsFor(manifest.minecraftVersion)
  const packagePath = spec.packageName.replace(/\./g, '/')
  const files: PlannedFile[] = []

  files.push({
    relativePath: 'gradle.properties',
    encoding: 'utf8',
    contents: [
      'org.gradle.jvmargs=-Xmx1G',
      'org.gradle.parallel=true',
      '',
      '# Versions from https://fabricmc.net/develop — CraftStudio Phase 2 pins (not model-chosen).',
      `minecraft_version=${pins.minecraft}`,
      `yarn_mappings=${pins.yarn}`,
      `loader_version=${pins.loader}`,
      '',
      `mod_version=1.0.0`,
      `maven_group=${spec.packageName}`,
      `archives_base_name=${spec.modId}`,
      '',
      `fabric_version=${pins.fabricApi}`,
      ''
    ].join('\n')
  })

  files.push({
    relativePath: 'settings.gradle',
    encoding: 'utf8',
    contents: `pluginManagement {
  repositories {
    maven { name = 'Fabric'; url = 'https://maven.fabricmc.net/' }
    mavenCentral()
    gradlePluginPortal()
  }
}

rootProject.name = '${spec.modId}'
`
  })

  files.push({
    relativePath: 'build.gradle',
    encoding: 'utf8',
    contents: `plugins {
  id 'fabric-loom' version '${pins.loom}'
  id 'maven-publish'
}

version = project.mod_version
group = project.maven_group

base {
  archivesName = project.archives_base_name
}

repositories {
}

dependencies {
  minecraft "com.mojang:minecraft:\${project.minecraft_version}"
  mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"
  modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"
  modImplementation "net.fabricmc.fabric-api:fabric-api:\${project.fabric_version}"
}

processResources {
  inputs.property "version", project.version
  filesMatching("fabric.mod.json") {
    expand "version": project.version
  }
}

tasks.withType(JavaCompile).configureEach {
  it.options.release = ${pins.java}
}

java {
  withSourcesJar()
  sourceCompatibility = JavaVersion.VERSION_${pins.java}
  targetCompatibility = JavaVersion.VERSION_${pins.java}
}

jar {
  from("LICENSE") {
    rename { "\${it}_\${project.base.archivesName.get()}" }
  }
}
`
  })

  files.push({
    relativePath: 'gradle/wrapper/gradle-wrapper.properties',
    encoding: 'utf8',
    contents: [
      'distributionBase=GRADLE_USER_HOME',
      'distributionPath=wrapper/dists',
      `distributionUrl=https\\://services.gradle.org/distributions/gradle-${pins.gradle}-bin.zip`,
      'networkTimeout=10000',
      'validateDistributionUrl=true',
      'zipStoreBase=GRADLE_USER_HOME',
      'zipStorePath=wrapper/dists',
      ''
    ].join('\n')
  })

  files.push({
    relativePath: 'gradle/wrapper/gradle-wrapper.jar',
    encoding: 'binary',
    contents: wrapperAsset('gradle-wrapper.jar')
  })
  files.push({
    relativePath: 'gradlew',
    encoding: 'utf8',
    contents: wrapperAsset('gradlew').toString('utf8')
  })
  files.push({
    relativePath: 'gradlew.bat',
    encoding: 'utf8',
    contents: wrapperAsset('gradlew.bat').toString('utf8')
  })

  files.push({
    relativePath: '.gitignore',
    encoding: 'utf8',
    contents: ['.gradle/', 'build/', 'run/', 'out/', '*.iml', '.idea/', '\n'].join('\n')
  })

  files.push({
    relativePath: 'src/main/resources/fabric.mod.json',
    encoding: 'utf8',
    contents: `${JSON.stringify(
      {
        schemaVersion: 1,
        id: spec.modId,
        version: '${version}',
        name: spec.displayName,
        description: spec.description || spec.displayName,
        authors: ['CraftStudio Local'],
        license: 'MIT',
        environment: '*',
        entrypoints: {
          main: [`${spec.packageName}.${spec.mainClass}`]
        },
        depends: {
          fabricloader: `>=${pins.loader}`,
          minecraft: `~${pins.minecraft}`,
          java: `>=${pins.java}`,
          'fabric-api': '*'
        }
      },
      null,
      2
    )}\n`
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

  for (const recipe of spec.recipes) {
    const ingredients = recipe.ingredients.map((ingredient) =>
      ingredient.kind === 'vanilla' ? { item: ingredient.id } : { item: `${spec.modId}:${ingredient.id}` }
    )
    files.push({
      relativePath: `src/main/resources/data/${spec.modId}/recipe/${recipe.id}.json`,
      encoding: 'utf8',
      contents: `${JSON.stringify(
        {
          type: 'minecraft:crafting_shapeless',
          ingredients,
          result: {
            id: `${spec.modId}:${recipe.resultItemId}`,
            count: recipe.resultCount
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
    contents: `package ${spec.packageName};

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.minecraft.item.Item;
import net.minecraft.item.ItemGroups;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ${spec.mainClass} implements ModInitializer {
  public static final String MOD_ID = "${javaEscape(spec.modId)}";
  public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

${itemJava(spec)}

  @Override
  public void onInitialize() {
    LOGGER.info("${javaEscape(spec.displayName)} initialized by CraftStudio Local Phase 2");
    ItemGroupEvents.modifyEntriesEvent(ItemGroups.INGREDIENTS).register(entries -> {
${itemAdds(spec)}
    });
${commandComments(spec)}
  }
}
`
  })

  files.push({
    relativePath: 'README.md',
    encoding: 'utf8',
    contents: [
      `# ${spec.displayName}`,
      '',
      spec.description || '_No description._',
      '',
      `Generated by CraftStudio Local Phase 2 for **Fabric ${pins.minecraft}** from a validated spec.`,
      'Build files come from trusted templates. The model never writes Gradle or Java directly.',
      '',
      '## Build',
      '',
      'Requires Java ' + pins.java + '.',
      '',
      '```bash',
      './gradlew build',
      '```',
      '',
      'Minecraft client launch (`runClient`) is not automated in Phase 2.',
      ''
    ].join('\n')
  })

  return files
}
