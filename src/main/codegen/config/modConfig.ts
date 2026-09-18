import type { ProjectSpec } from '../../../shared/spec'
import type { PlannedFile } from '../types'

export function defaultConfigJson(spec: ProjectSpec): string {
  return `${JSON.stringify(
    {
      enableWorldgen: spec.config.enableWorldgen,
      enableChestLoot: spec.config.enableChestLoot,
      spawnWeightScale: spec.config.spawnWeightScale
    },
    null,
    2
  )}\n`
}

export function fabricConfigJava(spec: ProjectSpec): string {
  return `package ${spec.packageName};

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import net.fabricmc.loader.api.FabricLoader;

public final class CraftStudioConfig {
  public static boolean enableWorldgen = ${spec.config.enableWorldgen};
  public static boolean enableChestLoot = ${spec.config.enableChestLoot};
  public static double spawnWeightScale = ${spec.config.spawnWeightScale}d;

  private CraftStudioConfig() {}

  public static void load() {
    Path path = FabricLoader.getInstance().getConfigDir().resolve(${spec.mainClass}.MOD_ID + ".json");
    try {
      if (!Files.exists(path)) {
        Files.createDirectories(path.getParent());
        Files.writeString(path, ${JSON.stringify(defaultConfigJson(spec))}, StandardCharsets.UTF_8);
        return;
      }
      JsonObject json = JsonParser.parseString(Files.readString(path)).getAsJsonObject();
      if (json.has("enableWorldgen")) {
        enableWorldgen = json.get("enableWorldgen").getAsBoolean();
      }
      if (json.has("enableChestLoot")) {
        enableChestLoot = json.get("enableChestLoot").getAsBoolean();
      }
      if (json.has("spawnWeightScale")) {
        spawnWeightScale = Math.min(4.0d, Math.max(0.25d, json.get("spawnWeightScale").getAsDouble()));
      }
    } catch (Exception ignored) {
      ${spec.mainClass}.LOGGER.warn("Could not read config {}; using spec defaults.", path);
    }
  }
}
`
}

export function forgeLikeConfigJava(spec: ProjectSpec, flavor: 'forge' | 'neoforge'): string {
  const paths = flavor === 'neoforge' ? 'net.neoforged.fml.loading.FMLPaths' : 'net.minecraftforge.fml.loading.FMLPaths'
  return `package ${spec.packageName};

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import ${paths};

public final class CraftStudioConfig {
  public static boolean enableWorldgen = ${spec.config.enableWorldgen};
  public static boolean enableChestLoot = ${spec.config.enableChestLoot};
  public static double spawnWeightScale = ${spec.config.spawnWeightScale}d;

  private CraftStudioConfig() {}

  public static void load() {
    Path path = FMLPaths.CONFIGDIR.get().resolve(${spec.mainClass}.MOD_ID + ".json");
    try {
      if (!Files.exists(path)) {
        Files.createDirectories(path.getParent());
        Files.writeString(path, ${JSON.stringify(defaultConfigJson(spec))}, StandardCharsets.UTF_8);
        return;
      }
      JsonObject json = JsonParser.parseString(Files.readString(path)).getAsJsonObject();
      if (json.has("enableWorldgen")) {
        enableWorldgen = json.get("enableWorldgen").getAsBoolean();
      }
      if (json.has("enableChestLoot")) {
        enableChestLoot = json.get("enableChestLoot").getAsBoolean();
      }
      if (json.has("spawnWeightScale")) {
        spawnWeightScale = Math.min(4.0d, Math.max(0.25d, json.get("spawnWeightScale").getAsDouble()));
      }
    } catch (Exception ignored) {
    }
  }
}
`
}

export function planConfigFiles(
  spec: ProjectSpec,
  packagePath: string,
  flavor: 'fabric' | 'forge' | 'neoforge'
): PlannedFile[] {
  return [
    {
      relativePath: `${spec.modId}.config.json`,
      encoding: 'utf8',
      contents: defaultConfigJson(spec)
    },
    {
      relativePath: `src/main/java/${packagePath}/CraftStudioConfig.java`,
      encoding: 'utf8',
      contents: flavor === 'fabric' ? fabricConfigJava(spec) : forgeLikeConfigJava(spec, flavor)
    },
    {
      relativePath: 'CONFIG.md',
      encoding: 'utf8',
      contents: [
        '# Mod config',
        '',
        `On first launch the loader writes \`config/${spec.modId}.json\` with these toggles:`,
        '',
        '- `enableWorldgen` — skip biome feature injection when false (JSON features still ship in the jar).',
        '- `enableChestLoot` — skip Fabric loot modify / Forge-NeoForge GLM apply when false.',
        `- \`spawnWeightScale\` — multiplies biome spawn weights (0.25–4). Default ${spec.config.spawnWeightScale}.`,
        '',
        flavor === 'fabric'
          ? 'Fabric reads the file from FabricLoader.getConfigDir().'
          : `${flavor} reads the file from FMLPaths.CONFIGDIR.`,
        'Plugins do not emit this config. A standalone datapack ZIP does not read it.',
        ''
      ].join('\n')
    }
  ]
}
