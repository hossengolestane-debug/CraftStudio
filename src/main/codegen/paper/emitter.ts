import { AppError } from '../../../shared/errors'
import { customModelDataFor, paperPinsFor, type PaperVersionPins } from '../../../shared/platformPins'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import type { ProjectManifest } from '../../../shared/types'
import { pluginGuiClass, pluginGuiJava, spawnMobJava } from '../plugin/bukkit'
import type { PlannedFile } from '../types'
import { gradleWrapperFiles, javaEscape, yamlEscape } from '../wrapper'

function vanillaToMaterial(id: string): string {
  return id.replace(/^minecraft:/, '').toUpperCase()
}

function pluginName(spec: ProjectSpec): string {
  return spec.mainClass.replace(/[^A-Za-z0-9]/g, '') || 'CraftStudioPlugin'
}

function applyCustomModelData(pins: PaperVersionPins, index: number): string {
  const cmd = customModelDataFor(index)
  if (pins.itemModel === 'predicate') {
    return `    meta.setCustomModelData(${cmd});`
  }
  return `    org.bukkit.inventory.meta.components.CustomModelDataComponent cmd = meta.getCustomModelDataComponent();
    cmd.setFloats(java.util.List.of(${cmd}f));
    meta.setCustomModelDataComponent(cmd);`
}

function itemFactory(spec: ProjectSpec, pins: PaperVersionPins): string {
  return spec.items
    .map((item, index) => {
      const method = `create${toConstName(item.id).replace(/_/g, '')}`
      return `  public ItemStack ${method}() {
    ItemStack stack = new ItemStack(Material.PAPER);
    ItemMeta meta = stack.getItemMeta();
    meta.displayName(Component.text("${javaEscape(item.displayName)}"));
    meta.lore(java.util.List.of(Component.text("CraftStudio custom item (vanilla paper + PDC + CustomModelData ${customModelDataFor(index)})")));
    meta.getPersistentDataContainer().set(ITEM_KEY, PersistentDataType.STRING, "${javaEscape(item.id)}");
    meta.setMaxStackSize(${item.maxCount});
${applyCustomModelData(pins, index)}
    stack.setItemMeta(meta);
    return stack;
  }`
    })
    .join('\n\n')
}

function recipeRegistration(spec: ProjectSpec): string {
  return spec.recipes
    .map((recipe) => {
      const resultMethod = `create${toConstName(recipe.resultItemId).replace(/_/g, '')}`
      const ingredients = recipe.ingredients
        .map((ingredient) => {
          if (ingredient.kind !== 'vanilla') {
            return `    // Mod-item ingredients are not registered as Paper materials; skipped ${ingredient.id}`
          }
          return `    recipe_${recipe.id}.addIngredient(Material.${vanillaToMaterial(ingredient.id)});`
        })
        .join('\n')
      return `    ShapelessRecipe recipe_${recipe.id} = new ShapelessRecipe(new NamespacedKey(this, "${recipe.id}"), ${resultMethod}());
${ingredients}
    getServer().addRecipe(recipe_${recipe.id});`
    })
    .join('\n')
}

function commandSwitch(spec: ProjectSpec): string {
  const cases = spec.items
    .map((item) => {
      const method = `create${toConstName(item.id).replace(/_/g, '')}`
      return `      case "${item.id}" -> ${method}();`
    })
    .join('\n')
  return cases
}

function paperMain(spec: ProjectSpec, pins: PaperVersionPins): string {
  const extraCommands = spec.commands
    .map(
      (command) =>
        `    // Spec command /${javaEscape(command.name)} is listed in plugin.yml. Handler shares givecustomitem.`
    )
    .join('\n')
  const attr = pins.minecraft === '1.21.4' || pins.minecraft === '1.21.8' ? 'MAX_HEALTH' : 'GENERIC_MAX_HEALTH'
  const menuRegs = spec.pluginGuis
    .map((gui) => `    getServer().getPluginManager().registerEvents(new ${pluginGuiClass(gui.id)}(this), this);`)
    .join('\n')
  const menuOpen = spec.pluginGuis
    .map(
      (gui) => `      case "${gui.id}" -> {
        new ${pluginGuiClass(gui.id)}(this).open(player);
        return true;
      }`
    )
    .join('\n')

  return `package ${spec.packageName};

import net.kyori.adventure.text.Component;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.ShapelessRecipe;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import org.jetbrains.annotations.NotNull;

public class ${spec.mainClass} extends JavaPlugin {
  public static final NamespacedKey ITEM_KEY = new NamespacedKey("craftstudio", "custom_item");
  public static final NamespacedKey MOB_KEY = new NamespacedKey("craftstudio", "custom_mob");

${itemFactory(spec, pins)}
${spawnMobJava(spec, 'adventure', attr)}

  @Override
  public void onEnable() {
    getLogger().info("${javaEscape(spec.displayName)} enabled (Paper). Custom items are vanilla paper + PDC — clients do not see a new item id. Custom mobs are vanilla disguises, not new client entity types.");
${recipeRegistration(spec)}
${menuRegs}
${extraCommands}
  }

  @Override
  public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
    if (!(sender instanceof Player player)) {
      sender.sendMessage("Players only.");
      return true;
    }
    if (label.equalsIgnoreCase("summoncustom")) {
      String id = args.length > 0 ? args[0] : "${spec.mobs[0]?.id ?? 'none'}";
      var spawned = spawnCustomMob(player.getWorld(), player.getLocation(), id);
      player.sendMessage(spawned == null ? "Unknown mob id." : "Spawned vanilla disguise for " + id + ". Clients do not see a new entity type.");
      return true;
    }
    if (label.equalsIgnoreCase("opencustommenu")) {
      String id = args.length > 0 ? args[0] : "${spec.pluginGuis[0]?.id ?? 'none'}";
      switch (id) {
${menuOpen}
        default -> player.sendMessage("Unknown menu id.");
      }
      return true;
    }
    String id = args.length > 0 ? args[0] : "${spec.items[0]?.id ?? 'custom_item'}";
    ItemStack stack = switch (id) {
${commandSwitch(spec)}
      default -> null;
    };
    if (stack == null) {
      player.sendMessage("Unknown CraftStudio item id. Try: ${spec.items.map((item) => item.id).join(', ')}");
      return true;
    }
    player.getInventory().addItem(stack);
    player.sendMessage("Gave " + id + " (vanilla paper + PDC + CustomModelData). Clients must install the CraftStudio resource pack.");
    return true;
  }
}
`
}

function pluginYml(spec: ProjectSpec, apiVersion: string): string {
  const commands = [`  givecustomitem:\n    description: Give a CraftStudio custom item (vanilla paper + PDC)\n    usage: /givecustomitem [item_id]`]
  if (spec.mobs.length) {
    commands.push(
      `  summoncustom:\n    description: Spawn a vanilla-disguise CraftStudio mob (not a new client entity type)\n    usage: /summoncustom [mob_id]`
    )
  }
  if (spec.pluginGuis.length) {
    commands.push(
      `  opencustommenu:\n    description: Open a CraftStudio inventory menu preview\n    usage: /opencustommenu [menu_id]`
    )
  }
  for (const command of spec.commands) {
    commands.push(
      `  ${command.name}:\n    description: ${yamlEscape(command.description || command.name)}\n    usage: /${command.name}`
    )
  }
  return [
    `name: ${pluginName(spec)}`,
    `version: '\${version}'`,
    `main: ${spec.packageName}.${spec.mainClass}`,
    `api-version: '${apiVersion}'`,
    `description: ${yamlEscape(spec.description || spec.displayName)}`,
    'authors: [CraftStudio Local]',
    'commands:',
    ...commands,
    ''
  ].join('\n')
}

export function planPaperFiles(manifest: ProjectManifest, spec: ProjectSpec): PlannedFile[] {
  if (manifest.platform !== 'paper' || manifest.type !== 'plugin') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: 'This emitter only generates Gradle projects for Paper plugins.',
      action: 'Create a Paper 1.21 / 1.21.1 / 1.21.4 / 1.21.8 project. Spigot is not inferred from Paper.'
    })
  }

  const pins = paperPinsFor(manifest.minecraftVersion)
  const packagePath = spec.packageName.replace(/\./g, '/')
  const files: PlannedFile[] = []

  files.push({
    relativePath: 'settings.gradle',
    encoding: 'utf8',
    contents: `rootProject.name = '${spec.modId}'\n`
  })

  files.push({
    relativePath: 'gradle.properties',
    encoding: 'utf8',
    contents: [
      'org.gradle.jvmargs=-Xmx1G',
      'org.gradle.parallel=true',
      '',
      '# Paper API coordinates are CraftStudio pins, not model-chosen.',
      `minecraft_version=${pins.minecraft}`,
      `paper_api=${pins.paperApi}`,
      'mod_version=1.0.0',
      `archives_base_name=${spec.modId}`,
      ''
    ].join('\n')
  })

  files.push({
    relativePath: 'build.gradle',
    encoding: 'utf8',
    contents: `plugins {
  id 'java'
}

version = '1.0.0'
group = '${spec.packageName}'

java {
  toolchain.languageVersion = JavaLanguageVersion.of(${pins.java})
}

repositories {
  mavenCentral()
  maven { url = 'https://repo.papermc.io/repository/maven-public/' }
}

dependencies {
  compileOnly 'io.papermc.paper:paper-api:${pins.paperApi}'
}

tasks.withType(JavaCompile).configureEach {
  options.release = ${pins.java}
  options.encoding = 'UTF-8'
}

processResources {
  filesMatching('plugin.yml') {
    expand version: project.version
  }
}

jar {
  archiveBaseName = '${spec.modId}'
}
`
  })

  files.push(...gradleWrapperFiles(pins.gradle))

  files.push({
    relativePath: '.gitignore',
    encoding: 'utf8',
    contents: ['.gradle/', 'build/', 'run/', 'run-paper/', 'out/', '*.iml', '.idea/', '\n'].join('\n')
  })

  files.push({
    relativePath: 'src/main/resources/plugin.yml',
    encoding: 'utf8',
    contents: pluginYml(spec, pins.apiVersion)
  })

  files.push({
    relativePath: `src/main/java/${packagePath}/${spec.mainClass}.java`,
    encoding: 'utf8',
    contents: paperMain(spec, pins)
  })

  for (const gui of spec.pluginGuis) {
    files.push({
      relativePath: `src/main/java/${packagePath}/${pluginGuiClass(gui.id)}.java`,
      encoding: 'utf8',
      contents: pluginGuiJava(spec, gui, 'adventure')
    })
  }

  if (spec.mobs.length > 0) {
    files.push({
      relativePath: 'MOBS.md',
      encoding: 'utf8',
      contents: [
        '# Paper custom mobs',
        '',
        'Paper cannot register a new client entity type.',
        'CraftStudio customizes an existing vanilla mob (zombie / pig / wolf) with a name, health, and PDC tag.',
        'Players still see the vanilla model unless they install a resource pack that restyles that vanilla entity.',
        'This is not a new client mob and is not Spigot-inferred from Paper.',
        ''
      ].join('\n')
    })
  }

  files.push({
    relativePath: 'run-paper/eula.txt',
    encoding: 'utf8',
    contents: [
      '# CraftStudio never accepts the Minecraft EULA for you.',
      '# Change this to true yourself only after you read https://www.minecraft.net/eula',
      'eula=false',
      ''
    ].join('\n')
  })

  files.push({
    relativePath: 'run-paper/README.md',
    encoding: 'utf8',
    contents: [
      '# Paper test-server prep',
      '',
      'CraftStudio does **not** download Paper, Minecraft, or a server jar.',
      'It does **not** set `eula=true`.',
      '',
      '1. Accept the Minecraft EULA and Paper terms yourself.',
      '2. Download a Paper build for ' + pins.minecraft + ' from https://papermc.io (you do this, not the app).',
      '3. Copy this project’s built plugin jar into that server’s `plugins/` folder.',
      '4. Do not run this jar on Spigot. Paper success is not Spigot compatibility.',
      '5. Clients see vanilla paper unless they install the exported resource pack (CustomModelData).',
      '',
      'Compile success is separate from runtime verification. Compatibility stays Experimental.',
      ''
    ].join('\n')
  })

  files.push({
    relativePath: 'INSTALL.md',
    encoding: 'utf8',
    contents: [
      `# Install ${spec.displayName}`,
      '',
      `Paper ${pins.minecraft} plugin · Java ${pins.java}`,
      '',
      '**Client limit:** Paper cannot register a new client item id. Players see vanilla paper + CustomModelData. Every client must install the exported resource pack from the Export tab.',
      '',
      '1. Build with `./gradlew build`.',
      `2. Copy \`build/libs/${spec.modId}-1.0.0.jar\` into a Paper ${pins.minecraft} server \`plugins/\` folder.`,
      '3. Accept Minecraft / Paper terms yourself. CraftStudio never distributes game files.',
      '4. In game: `/givecustomitem ' + (spec.items[0]?.id ?? 'item') + '`',
      '5. Do not install this jar on Spigot and do not treat Paper success as Spigot support.',
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
      `Generated by CraftStudio Local Phase 3 for **Paper ${pins.minecraft}**.`,
      'Custom items use Material.PAPER + PersistentDataContainer + CustomModelData. Clients must install the resource pack. No new client item type.',
      '',
      '```bash',
      './gradlew build',
      '```',
      '',
      'See INSTALL.md and run-paper/README.md. Spigot is not supported by this emitter.',
      ''
    ].join('\n')
  })

  return files
}
