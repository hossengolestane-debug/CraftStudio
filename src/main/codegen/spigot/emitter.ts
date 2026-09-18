import { AppError } from '../../../shared/errors'
import { spigotPinsFor } from '../../../shared/platformPins'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import type { ProjectManifest } from '../../../shared/types'
import { defaultCommandPermission, defaultMenuPermission } from '../../../shared/spawn'
import {
  pluginCommandPermissionsYml,
  pluginGuiClass,
  pluginGuiJava,
  pluginTabCompleteJava,
  spawnMobJava,
  vanillaMaterial
} from '../plugin/bukkit'
import { planPluginSpawnGap } from '../spawn/biomeTables'
import type { PlannedFile } from '../types'
import { gradleWrapperFiles, javaEscape, yamlEscape } from '../wrapper'

function pluginName(spec: ProjectSpec): string {
  return spec.mainClass.replace(/[^A-Za-z0-9]/g, '') || 'CraftStudioPlugin'
}

function itemFactory(spec: ProjectSpec): string {
  return spec.items
    .map((item) => {
      const method = `create${toConstName(item.id).replace(/_/g, '')}`
      return `  public ItemStack ${method}() {
    ItemStack stack = new ItemStack(Material.PAPER);
    ItemMeta meta = stack.getItemMeta();
    meta.setDisplayName("${javaEscape(item.displayName)}");
    meta.setLore(java.util.List.of("CraftStudio custom item (vanilla paper + PDC). Not a new client id."));
    meta.getPersistentDataContainer().set(ITEM_KEY, PersistentDataType.STRING, "${javaEscape(item.id)}");
    meta.setCustomModelData(${spec.items.findIndex((entry) => entry.id === item.id) + 1});
    stack.setItemMeta(meta);
    return stack;
  }`
    })
    .join('\n\n')
}

export function planSpigotFiles(manifest: ProjectManifest, spec: ProjectSpec): PlannedFile[] {
  if (manifest.platform !== 'spigot' || manifest.type !== 'plugin') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: 'This emitter only generates Gradle projects for Spigot plugins.',
      action: 'Create a Spigot 1.21 / 1.21.1 / 1.21.4 project. Paper APIs are not copied into this output.'
    })
  }
  const pins = spigotPinsFor(manifest.minecraftVersion)
  const packagePath = spec.packageName.replace(/\./g, '/')
  const attr = pins.minecraft === '1.21.4' ? 'MAX_HEALTH' : 'GENERIC_MAX_HEALTH'
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
      '',
      '# Spigot API coordinates are CraftStudio pins. Not copied from Paper.',
      `minecraft_version=${pins.minecraft}`,
      `spigot_api=${pins.spigotApi}`,
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
  maven { url = 'https://hub.spigotmc.org/nexus/content/repositories/snapshots/' }
}

dependencies {
  compileOnly 'org.spigotmc:spigot-api:${pins.spigotApi}'
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
    contents: ['.gradle/', 'build/', 'run/', 'run-spigot/', 'out/', '*.iml', '.idea/', '\n'].join('\n')
  })

  const commands = [
    '  givecustomitem:',
    '    description: Give a CraftStudio custom item (vanilla paper + PDC)',
    '    usage: /givecustomitem [item_id]',
    `    permission: ${spec.modId}.item.give`
  ]
  if (spec.mobs.length) {
    commands.push(
      '  summoncustom:',
      '    description: Spawn a vanilla-disguise CraftStudio mob',
      '    usage: /summoncustom [mob_id]',
      `    permission: ${spec.modId}.mob.summon`
    )
  }
  if (spec.pluginGuis.length) {
    commands.push('  opencustommenu:', '    description: Open a CraftStudio inventory menu', '    usage: /opencustommenu [menu_id]')
  }
  for (const command of spec.commands) {
    commands.push(
      `  ${command.name}:`,
      `    description: ${yamlEscape(command.description || command.name)}`,
      `    usage: /${command.name}`,
      `    permission: ${command.permission?.trim() || defaultCommandPermission(spec.modId, command.name)}`
    )
  }

  files.push({
    relativePath: 'src/main/resources/plugin.yml',
    encoding: 'utf8',
    contents: [
      `name: ${pluginName(spec)}`,
      `version: '\${version}'`,
      `main: ${spec.packageName}.${spec.mainClass}`,
      `api-version: '${pins.apiVersion}'`,
      `description: ${yamlEscape(spec.description || spec.displayName)}`,
      'authors: [CraftStudio Local]',
      'commands:',
      ...commands,
      pluginCommandPermissionsYml(spec),
      ''
    ].join('\n')
  })

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

  const recipeBits = spec.recipes
    .map((recipe) => {
      const result = `create${toConstName(recipe.resultItemId).replace(/_/g, '')}`
      const ings = recipe.ingredients
        .map((ingredient) =>
          ingredient.kind === 'vanilla'
            ? `    recipe_${recipe.id}.addIngredient(Material.${vanillaMaterial(ingredient.id)});`
            : `    // Mod-item ingredients are not Spigot materials; skipped ${ingredient.id}`
        )
        .join('\n')
      return `    ShapelessRecipe recipe_${recipe.id} = new ShapelessRecipe(new NamespacedKey(this, "${recipe.id}"), ${result}());
${ings}
    getServer().addRecipe(recipe_${recipe.id});`
    })
    .join('\n')

  files.push({
    relativePath: `src/main/java/${packagePath}/${spec.mainClass}.java`,
    encoding: 'utf8',
    contents: `package ${spec.packageName};

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

public class ${spec.mainClass} extends JavaPlugin implements org.bukkit.command.TabCompleter {
  public static final NamespacedKey ITEM_KEY = new NamespacedKey("craftstudio", "custom_item");
  public static final NamespacedKey MOB_KEY = new NamespacedKey("craftstudio", "custom_mob");

${itemFactory(spec)}
${spawnMobJava(spec, 'legacy', attr)}

  @Override
  public void onEnable() {
    getLogger().info("${javaEscape(spec.displayName)} enabled (Spigot). Items are vanilla paper + PDC. Mobs are vanilla disguises. Paper APIs are not used.");
${recipeBits}
${menuRegs}
    var giveCmd = getCommand("givecustomitem");
    if (giveCmd != null) {
      giveCmd.setTabCompleter(this);
    }
    var summonCmd = getCommand("summoncustom");
    if (summonCmd != null) {
      summonCmd.setTabCompleter(this);
    }
    var menuCmd = getCommand("opencustommenu");
    if (menuCmd != null) {
      menuCmd.setTabCompleter(this);
    }
  }

${pluginTabCompleteJava(spec)}

  @Override
  public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
    if (!(sender instanceof Player player)) {
      sender.sendMessage("Players only.");
      return true;
    }
    if (label.equalsIgnoreCase("summoncustom")) {
      if (!player.hasPermission("${spec.modId}.mob.summon")) {
        player.sendMessage("Missing permission ${spec.modId}.mob.summon");
        return true;
      }
      String id = args.length > 0 ? args[0] : "${spec.mobs[0]?.id ?? 'none'}";
      var spawned = spawnCustomMob(player.getWorld(), player.getLocation(), id);
      player.sendMessage(spawned == null ? "Unknown mob id." : "Spawned vanilla disguise for " + id + ". Clients do not see a new entity type.");
      return true;
    }
    if (label.equalsIgnoreCase("opencustommenu")) {
      String id = args.length > 0 ? args[0] : "${spec.pluginGuis[0]?.id ?? 'none'}";
      if (!player.hasPermission("${spec.modId}.menu." + id)) {
        player.sendMessage("Missing permission ${spec.modId}.menu." + id);
        return true;
      }
      switch (id) {
${menuOpen}
        default -> player.sendMessage("Unknown menu id.");
      }
      return true;
    }
    if (!player.hasPermission("${spec.modId}.item.give")) {
      player.sendMessage("Missing permission ${spec.modId}.item.give");
      return true;
    }
    String id = args.length > 0 ? args[0] : "${spec.items[0]?.id ?? 'custom_item'}";
    ItemStack stack = switch (id) {
${spec.items.map((item) => `      case "${item.id}" -> create${toConstName(item.id).replace(/_/g, '')}();`).join('\n')}
      default -> null;
    };
    if (stack == null) {
      player.sendMessage("Unknown item id.");
      return true;
    }
    player.getInventory().addItem(stack);
    player.sendMessage("Gave " + id + " (vanilla paper + PDC). Install a resource pack on the client if you painted one.");
    return true;
  }
}
`
  })

  for (const gui of spec.pluginGuis) {
    files.push({
      relativePath: `src/main/java/${packagePath}/${pluginGuiClass(gui.id)}.java`,
      encoding: 'utf8',
      contents: pluginGuiJava(spec, gui, 'legacy')
    })
  }
  files.push(...planPluginSpawnGap(spec))

  files.push({
    relativePath: 'run-spigot/eula.txt',
    encoding: 'utf8',
    contents: [
      '# CraftStudio never accepts the Minecraft EULA for you.',
      '# Change this to true yourself only after you read https://www.minecraft.net/eula',
      'eula=false',
      ''
    ].join('\n')
  })
  files.push({
    relativePath: 'run-spigot/README.md',
    encoding: 'utf8',
    contents: [
      '# Spigot test-server prep',
      '',
      'CraftStudio does not download BuildTools, Spigot, or Minecraft.',
      'It does not set eula=true.',
      '',
      '1. Build Spigot yourself with BuildTools for ' + pins.minecraft + '.',
      '2. Copy this plugin jar into that server plugins/ folder.',
      '3. Do not treat Paper success as Spigot compatibility.',
      '4. Custom mobs are vanilla entity disguises. There is no new client entity type.',
      ''
    ].join('\n')
  })
  files.push({
    relativePath: 'INSTALL.md',
    encoding: 'utf8',
    contents: [
      `# Install ${spec.displayName}`,
      '',
      `Spigot ${pins.minecraft} plugin · Java ${pins.java}`,
      '',
      'Uses org.spigotmc:spigot-api only. Adventure / Paper APIs are intentionally absent.',
      '',
      '1. `./gradlew build`',
      `2. Copy build/libs/${spec.modId}-1.0.0.jar into a Spigot ${pins.minecraft} plugins/ folder.`,
      '3. Accept Minecraft terms yourself.',
      '',
      '## Permission nodes',
      '',
      `- \`/givecustomitem\` → \`${spec.modId}.item.give\``,
      spec.mobs.length ? `- \`/summoncustom\` → \`${spec.modId}.mob.summon\`` : '',
      ...spec.pluginGuis.map((gui) => `- \`/opencustommenu ${gui.id}\` → \`${defaultMenuPermission(spec.modId, gui.id)}\``),
      ...spec.commands.map(
        (command) =>
          `- \`/${command.name}\` → \`${command.permission?.trim() || defaultCommandPermission(spec.modId, command.name)}\``
      ),
      spec.mobs.some((mob) => mob.spawn.enabled)
        ? 'Biome spawn tables are unsupported on Spigot. See SPAWNS.md.'
        : '',
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
      `Generated by CraftStudio Local for **Spigot ${pins.minecraft}**. Not a Paper plugin.`,
      '',
      '```bash',
      './gradlew build',
      '```',
      ''
    ].join('\n')
  })

  return files
}
