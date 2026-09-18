import { AppError } from '../../../shared/errors'
import { itemModelJson } from '../../../shared/itemModels'
import { fabricPinsFor, type FabricItemRegistration } from '../../../shared/platformPins'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import type { ProjectManifest } from '../../../shared/types'
import type { PlannedFile } from '../types'
import { gradleWrapperFiles, javaEscape } from '../wrapper'
import {
  fabricAttributeLines,
  fabricEntityFields,
  fabricMenuField,
  planFabricClientFiles,
  planFabricEntityRenderers,
  planFabricGuiFiles,
  planFabricMobFiles,
  placeholderEntityPng
} from './extras'

function itemJavaClassic(spec: ProjectSpec): string {
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

function itemKeys(spec: ProjectSpec): string {
  return spec.items
    .map((item) => {
      const constant = toConstName(item.id)
      return `  public static final RegistryKey<Item> ${constant}_KEY = RegistryKey.of(
    RegistryKeys.ITEM,
    Identifier.of(MOD_ID, "${item.id}")
  );`
    })
    .join('\n\n')
}

function itemJavaRegistryKey(spec: ProjectSpec): string {
  return spec.items
    .map((item) => {
      const constant = toConstName(item.id)
      return `  public static final Item ${constant} = Items.register(
    ${constant}_KEY,
    Item::new,
    new Item.Settings().maxCount(${item.maxCount})
  );`
    })
    .join('\n\n')
}

function itemAdds(spec: ProjectSpec): string {
  return spec.items.map((item) => `      entries.add(${toConstName(item.id)});`).join('\n')
}

function commandBlocks(spec: ProjectSpec): string {
  if (spec.commands.length === 0) {
    return ''
  }
  return spec.commands
    .map(
      (command) =>
        `    dispatcher.register(CommandManager.literal("${javaEscape(command.name)}").executes(context -> {
      context.getSource().sendFeedback(() -> Text.literal("CraftStudio command /${javaEscape(command.name)}"), false);
      return 1;
    }));`
    )
    .join('\n')
}

function fabricImports(
  style: FabricItemRegistration,
  spec: ProjectSpec
): string {
  const hasCommands = spec.commands.length > 0
  const hasMobs = spec.mobs.length > 0
  const hasGuis = spec.modGuis.length > 0
  const lines = [
    'import net.fabricmc.api.ModInitializer;',
    'import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;',
    'import net.minecraft.item.Item;',
    'import net.minecraft.item.ItemGroups;'
  ]
  if (style === 'registry_key') {
    lines.push('import net.minecraft.item.Items;')
    lines.push('import net.minecraft.registry.RegistryKey;')
    lines.push('import net.minecraft.registry.RegistryKeys;')
  }
  if (style === 'classic' || hasMobs || hasGuis) {
    lines.push('import net.minecraft.registry.Registries;')
    lines.push('import net.minecraft.registry.Registry;')
  }
  lines.push('import net.minecraft.util.Identifier;')
  if (hasMobs) {
    lines.push('import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;')
    lines.push('import net.minecraft.entity.EntityType;')
    lines.push('import net.minecraft.entity.SpawnGroup;')
  }
  if (hasGuis) {
    lines.push('import net.minecraft.resource.featuretoggle.FeatureFlags;')
    lines.push('import net.minecraft.screen.ScreenHandlerType;')
  }
  if (hasCommands) {
    lines.push('import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;')
    lines.push('import net.minecraft.server.command.CommandManager;')
    lines.push('import net.minecraft.text.Text;')
  }
  lines.push('import org.slf4j.Logger;')
  lines.push('import org.slf4j.LoggerFactory;')
  return [...new Set(lines)].join('\n')
}

function mainJava(spec: ProjectSpec, style: FabricItemRegistration): string {
  const items =
    style === 'registry_key'
      ? `${itemKeys(spec)}\n\n${itemJavaRegistryKey(spec)}`
      : itemJavaClassic(spec)
  const entities = spec.mobs.length ? `\n\n${fabricEntityFields(spec, style)}` : ''
  const menu = spec.modGuis.length ? `\n\n${fabricMenuField(spec, style)}` : ''
  const commands = spec.commands.length
    ? `
    CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
${commandBlocks(spec)}
    });`
    : ''
  const attrs = spec.mobs.length ? `\n${fabricAttributeLines(spec)}` : ''

  return `package ${spec.packageName};

${fabricImports(style, spec)}

public class ${spec.mainClass} implements ModInitializer {
  public static final String MOD_ID = "${javaEscape(spec.modId)}";
  public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

${items}${entities}${menu}

  @Override
  public void onInitialize() {
    LOGGER.info("${javaEscape(spec.displayName)} initialized by CraftStudio Local Phase 5");
    ItemGroupEvents.modifyEntriesEvent(ItemGroups.INGREDIENTS).register(entries -> {
${itemAdds(spec)}
    });
${attrs}
${commands}
  }
}
`
}

export function planFabricFiles(manifest: ProjectManifest, spec: ProjectSpec): PlannedFile[] {
  if (manifest.platform !== 'fabric' || manifest.type !== 'mod') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: 'This emitter only generates Gradle projects for Fabric mods.',
      action: 'Create a Fabric project on a supported 1.21.x version.'
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
      '# Versions from https://fabricmc.net/develop — CraftStudio pins (not model-chosen).',
      `minecraft_version=${pins.minecraft}`,
      `yarn_mappings=${pins.yarn}`,
      `loader_version=${pins.loader}`,
      '',
      'mod_version=1.0.0',
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

  files.push(...gradleWrapperFiles(pins.gradle))

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
          main: [`${spec.packageName}.${spec.mainClass}`],
          ...(spec.modGuis.length > 0 || spec.mobs.length > 0
            ? { client: [`${spec.packageName}.${spec.mainClass}Client`] }
            : {})
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
  for (const mob of spec.mobs) {
    lang[`entity.${spec.modId}.${mob.id}`] = mob.displayName
  }
  for (const gui of spec.modGuis) {
    lang[`container.${spec.modId}.${gui.id}`] = gui.title
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
      contents: itemModelJson(spec.modId, item).replace(
        `${spec.modId}:item/${item.id}`,
        'minecraft:item/flint'
      )
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
    contents: mainJava(spec, pins.itemRegistration)
  })

  const classic = pins.itemRegistration === 'classic'
  files.push(...planFabricMobFiles(spec, packagePath, classic))
  files.push(...planFabricGuiFiles(spec, packagePath))
  files.push(...planFabricEntityRenderers(spec, packagePath, classic))
  files.push(...planFabricClientFiles(spec, packagePath, classic))
  if (spec.mobs.length > 0) {
    files.push({
      relativePath: `src/main/resources/assets/${spec.modId}/textures/entity/preset_mob.png`,
      encoding: 'binary',
      contents: placeholderEntityPng()
    })
    files.push({
      relativePath: 'ENTITY_RENDERING.md',
      encoding: 'utf8',
      contents: [
        '# Entity rendering note',
        '',
        classic
          ? `Fabric ${pins.minecraft}: a compiling custom cube model is registered. Vanilla model classes are typed to vanilla entities and are not used.`
          : `Fabric ${pins.minecraft}: a compiling render-state EntityRenderer is registered but draws nothing. Entities are invisible in-game. A client join warning is shown.`,
        'This is not a Minecraft-verified custom model. Spawn is summon/command only.',
        ''
      ].join('\n')
    })
  }

  files.push({
    relativePath: 'INSTALL.md',
    encoding: 'utf8',
    contents: [
      `# Install ${spec.displayName}`,
      '',
      `Fabric ${pins.minecraft} · Java ${pins.java} · item API: ${pins.itemRegistration}`,
      '',
      '1. Install the Minecraft launcher and this exact game version.',
      '2. Install [Fabric Loader](https://fabricmc.net/use/) for that version, plus Fabric API.',
      '3. Build with `./gradlew build`, then copy `build/libs/' +
        spec.modId +
        '-1.0.0.jar` (not `-sources`) into `.minecraft/mods`.',
      '4. Optional: export a resource pack from the app (includes pack.png and layer1 when painted) if you want textures without rebuilding the jar.',
      '5. Accept the Minecraft EULA yourself. CraftStudio never distributes game files or bypasses auth.',
      '',
      spec.modGuis.length > 0
        ? 'Open the preview screen from in-game after you wire a use/command in a later edit, or use the Test tab runClient. Client clicks are untrusted; the server menu validates slots.'
        : '',
      spec.mobs.length > 0
        ? 'Summon preset mobs with `/summon ' + spec.modId + ':' + spec.mobs[0]!.id + '`. See ENTITY_RENDERING.md.'
        : '',
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
      `Generated by CraftStudio Local Phase 3 for **Fabric ${pins.minecraft}** (${pins.itemRegistration} item registration).`,
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
      'Optional (after you accept Minecraft terms in the app): `./gradlew runClient`.',
      'See INSTALL.md. Compatibility stays Experimental until a real client run is verified.',
      ''
    ].join('\n')
  })

  return files
}
