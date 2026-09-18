import { AppError } from '../../../shared/errors'
import { itemModelJson } from '../../../shared/itemModels'
import { forgePinsFor } from '../../../shared/platformPins'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import type { ProjectManifest } from '../../../shared/types'
import { defaultCommandPermission } from '../../../shared/spawn'
import {
  forgeLikeClientStyle,
  forgeLikeEntityRenderingNote,
  planForgeLikeEntityClientFiles
} from '../entities/forgeLikeClient'
import { fabricSpawnDoc, placeholderEntityPng } from '../fabric/extras'
import { isHostileMob, mojangGoalBlock, mojangParent } from '../mobs/presets'
import { forgeLikeCommandMethod, forgeLikeMenuFields, planForgeLikeMenuFiles } from '../modgui/forgeLike'
import { mojangItemProperties, mojangNeedsAttributeImports } from '../items/settings'
import {
  blockLangEntries,
  forgeBlockCreative,
  forgeBlockRegs,
  forgeNeedsRotatedPillar,
  forgeNeedsSlab,
  forgeNeedsStairs,
  planBlockAssetFiles,
  planBlockDocs
} from '../blocks/registration'
import { planConfigFiles } from '../config/modConfig'
import { planForgeLikeLootModifierFiles } from '../loot/inject'
import { planEntityLootFiles, planItemLootFiles, planLootDocs } from '../loot/tables'
import { entityClassName } from '../naming'
import { planRecipeFiles } from '../recipes/json'
import { planBiomeModifierFiles } from '../spawn/biomeTables'
import type { PlannedFile } from '../types'
import { gradleWrapperFiles, javaEscape } from '../wrapper'
import { planOreBiomeModifiers, planOreFeatureJson, planWorldgenDocs } from '../worldgen/oreVeins'
import { needsForgeWeaponCode, planForgeWeaponFiles } from '../weapons/forgeWeapon'
import { hasWeaponBehavior } from '../../../shared/weaponSpec'

function propsEscape(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\\/g, '\\\\')
}

function itemRegs(spec: ProjectSpec): string {
  return spec.items
    .map((item) => {
      const props = mojangItemProperties(item)
      const ctor = item.weapon?.smash
        ? `new CraftStudioMaceItem(${props}, CraftStudioWeaponAbilities.${toConstName(item.id)})`
        : hasWeaponBehavior(item.weapon)
          ? `new CraftStudioAbilityItem(${props}, CraftStudioWeaponAbilities.${toConstName(item.id)})`
          : `new Item(${props})`
      return `  public static final RegistryObject<Item> ${toConstName(item.id)} = ITEMS.register("${item.id}",
    () -> ${ctor});`
    })
    .join('\n\n')
}

function planEntityFiles(spec: ProjectSpec, packagePath: string): PlannedFile[] {
  const files: PlannedFile[] = []
  for (const mob of spec.mobs) {
    const cls = entityClassName(mob.id)
    const parent = mojangParent(mob)
    files.push({
      relativePath: `src/main/java/${packagePath}/${cls}.java`,
      encoding: 'utf8',
      contents: `package ${spec.packageName};

import ${parent.importName};
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.AgeableMob;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.AvoidEntityGoal;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.LeapAtTargetGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.world.entity.ai.goal.PanicGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.monster.Monster;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.jetbrains.annotations.Nullable;

public class ${cls} extends ${parent.extend} {
  public ${cls}(EntityType<? extends ${cls}> type, Level level) {
    super(type, level);
  }

  public static AttributeSupplier.Builder createAttributes() {
    return ${parent.extend}.createMobAttributes()
      .add(Attributes.MAX_HEALTH, ${mob.health}d)
      .add(Attributes.MOVEMENT_SPEED, ${mob.movementSpeed}d)
      .add(Attributes.ATTACK_DAMAGE, ${mob.attackDamage}d)
      .add(Attributes.FOLLOW_RANGE, ${mob.followRange ?? 16}d);
  }

  @Override
  protected void registerGoals() {
    this.goalSelector.addGoal(0, new FloatGoal(this));
${mojangGoalBlock(mob)}    this.goalSelector.addGoal(4, new LookAtPlayerGoal(this, Player.class, 8.0f));
    this.goalSelector.addGoal(5, new RandomLookAroundGoal(this));
  }

  ${
    parent.extend === 'Animal'
      ? `@Nullable
  @Override
  public AgeableMob getBreedOffspring(ServerLevel level, AgeableMob other) {
    return null;
  }

  @Override
  public boolean isFood(ItemStack stack) {
    return false;
  }`
      : ''
  }
}
`
    })
  }
  return files
}

export function planForgeFiles(manifest: ProjectManifest, spec: ProjectSpec): PlannedFile[] {
  if (manifest.platform !== 'forge' || manifest.type !== 'mod') {
    throw new AppError({
      code: 'ADAPTER_UNSUPPORTED',
      message: 'This emitter only generates Gradle projects for Forge mods.',
      action: 'Create a Forge 1.21.1 project. NeoForge is a separate adapter and is not inferred from Forge.'
    })
  }
  const pins = forgePinsFor(manifest.minecraftVersion)
  const packagePath = spec.packageName.replace(/\./g, '/')
  const files: PlannedFile[] = []

  files.push({
    relativePath: 'gradle.properties',
    encoding: 'utf8',
    contents: [
      'org.gradle.jvmargs=-Xmx1G',
      'org.gradle.parallel=true',
      '',
      '# Versions from maven.minecraftforge.net — CraftStudio pins (not model-chosen).',
      '# This is Forge. It is not a NeoForge compatibility claim.',
      `minecraft_version=${pins.minecraft}`,
      `minecraft_version_range=${pins.minecraftVersionRange}`,
      `forge_version=${pins.forgeVersion}`,
      `forge_version_range=${pins.forgeVersionRange}`,
      `loader_version_range=${pins.loaderVersionRange}`,
      `mapping_channel=${pins.mappingChannel}`,
      `mapping_version=${pins.mappingVersion}`,
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
    maven { name = 'MinecraftForge'; url = 'https://maven.minecraftforge.net/' }
  }
}

rootProject.name = '${spec.modId}'
`
  })

  files.push({
    relativePath: 'build.gradle',
    encoding: 'utf8',
    contents: `plugins {
  id 'eclipse'
  id 'idea'
  id 'net.minecraftforge.gradle' version '${pins.forgeGradle}'
}

version = project.mod_version
group = project.mod_group_id

base {
  archivesName = project.mod_id
}

java.toolchain.languageVersion = JavaLanguageVersion.of(${pins.java})

minecraft {
  mappings channel: project.mapping_channel, version: project.mapping_version
  copyIdeResources = true

  runs {
    configureEach {
      workingDirectory project.file('run')
      property 'forge.logging.markers', 'REGISTRIES'
      property 'forge.logging.console.level', 'debug'
      mods {
        "\${mod_id}" {
          source sourceSets.main
        }
      }
    }
    client {
    }
    server {
      args '--nogui'
    }
  }
}

repositories {
}

dependencies {
  minecraft "net.minecraftforge:forge:\${minecraft_version}-\${forge_version}"
}

tasks.named('processResources', ProcessResources).configure {
  var replaceProperties = [
    minecraft_version      : minecraft_version,
    minecraft_version_range: minecraft_version_range,
    forge_version          : forge_version,
    forge_version_range    : forge_version_range,
    loader_version_range   : loader_version_range,
    mod_id                 : mod_id,
    mod_name               : mod_name,
    mod_license            : mod_license,
    mod_version            : mod_version,
    mod_authors            : mod_authors,
    mod_description        : mod_description
  ]
  inputs.properties replaceProperties
  filesMatching(['META-INF/mods.toml']) {
    expand replaceProperties
  }
}

tasks.withType(JavaCompile).configureEach {
  options.encoding = 'UTF-8'
  options.release = ${pins.java}
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
    relativePath: 'src/main/resources/META-INF/mods.toml',
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
      'modId="forge"',
      'mandatory=true',
      'versionRange="${forge_version_range}"',
      'ordering="NONE"',
      'side="BOTH"',
      '',
      '[[dependencies.${mod_id}]]',
      'modId="minecraft"',
      'mandatory=true',
      'versionRange="${minecraft_version_range}"',
      'ordering="NONE"',
      'side="BOTH"',
      ''
    ].join('\n')
  })

  const entityRegs = spec.mobs
    .map((mob) => {
      const cls = entityClassName(mob.id)
      const size = mob.appearance.model === 'quadruped' ? '0.9f, 0.9f' : '0.6f, 1.95f'
      const category = isHostileMob(mob) ? 'MobCategory.MONSTER' : 'MobCategory.CREATURE'
      return `  public static final RegistryObject<EntityType<${cls}>> ${toConstName(mob.id)} = ENTITIES.register("${mob.id}",
    () -> EntityType.Builder.of(${cls}::new, ${category}).sized(${size}).build("${mob.id}"));`
    })
    .join('\n\n')

  const attrRegs = spec.mobs
    .map((mob) => `      event.put(${toConstName(mob.id)}.get(), ${entityClassName(mob.id)}.createAttributes().build());`)
    .join('\n')

  const combatItems = spec.items.filter((item) => hasWeaponBehavior(item.weapon))
  const ingredientItems = spec.items.filter((item) => !hasWeaponBehavior(item.weapon))
  const creativeIngredients = ingredientItems.map((item) => `      event.accept(${toConstName(item.id)});`).join('\n')
  const creativeCombat = combatItems.map((item) => `      event.accept(${toConstName(item.id)});`).join('\n')
  const injectLoot = spec.config.enableChestLoot

  files.push({
    relativePath: `src/main/java/${packagePath}/${spec.mainClass}.java`,
    encoding: 'utf8',
    contents: `package ${spec.packageName};

${spec.mobs.length ? `import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.minecraftforge.event.entity.EntityAttributeCreationEvent;` : ''}
${spec.modGuis.length ? `import net.minecraft.world.inventory.MenuType;
import net.minecraftforge.common.extensions.IForgeMenuType;` : ''}
${spec.modGuis.length > 0 || spec.commands.length > 0 ? `import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.event.RegisterCommandsEvent;` : ''}
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
${spec.blocks.length ? `import net.minecraft.world.item.BlockItem;
import net.minecraft.world.level.block.Block;
${forgeNeedsRotatedPillar(spec) ? 'import net.minecraft.world.level.block.RotatedPillarBlock;' : ''}
${forgeNeedsSlab(spec) ? 'import net.minecraft.world.level.block.SlabBlock;' : ''}
${forgeNeedsStairs(spec) ? 'import net.minecraft.world.level.block.StairBlock;' : ''}
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;` : ''}
${injectLoot && (spec.items.length > 0 || spec.blocks.length > 0) ? `import net.minecraftforge.common.loot.IGlobalLootModifier;
import com.mojang.serialization.MapCodec;` : ''}
${mojangNeedsAttributeImports(spec.items) ? `import net.minecraft.world.entity.EquipmentSlotGroup;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.item.component.ItemAttributeModifiers;
import net.minecraft.resources.ResourceLocation;` : ''}
import net.minecraftforge.event.BuildCreativeModeTabContentsEvent;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

@Mod(${spec.mainClass}.MOD_ID)
public class ${spec.mainClass} {
  public static final String MOD_ID = "${javaEscape(spec.modId)}";
  public static final DeferredRegister<Item> ITEMS = DeferredRegister.create(ForgeRegistries.ITEMS, MOD_ID);
${spec.blocks.length ? `  public static final DeferredRegister<Block> BLOCKS = DeferredRegister.create(ForgeRegistries.BLOCKS, MOD_ID);
${injectLoot ? `  public static final DeferredRegister<MapCodec<? extends IGlobalLootModifier>> LOOT_MODIFIERS = DeferredRegister.create(ForgeRegistries.Keys.GLOBAL_LOOT_MODIFIER_SERIALIZERS, MOD_ID);` : ''}` : injectLoot && spec.items.length > 0 ? `  public static final DeferredRegister<MapCodec<? extends IGlobalLootModifier>> LOOT_MODIFIERS = DeferredRegister.create(ForgeRegistries.Keys.GLOBAL_LOOT_MODIFIER_SERIALIZERS, MOD_ID);` : ''}
${spec.mobs.length ? `  public static final DeferredRegister<EntityType<?>> ENTITIES = DeferredRegister.create(ForgeRegistries.ENTITY_TYPES, MOD_ID);` : ''}
${spec.modGuis.length ? forgeLikeMenuFields(spec, 'forge') : ''}

${itemRegs(spec)}
${spec.blocks.length ? `\n${forgeBlockRegs(spec)}` : ''}
${injectLoot && (spec.items.length > 0 || spec.blocks.length > 0) ? `  public static final RegistryObject<MapCodec<? extends IGlobalLootModifier>> ADD_BONUS_CHEST = LOOT_MODIFIERS.register("add_bonus_chest", () -> AddBonusChestModifier.CODEC);` : ''}
${entityRegs}

  public ${spec.mainClass}(FMLJavaModLoadingContext context) {
    CraftStudioConfig.load();
    IEventBus bus = context.getModEventBus();
    ${spec.blocks.length ? 'BLOCKS.register(bus);' : ''}
    ITEMS.register(bus);
    ${injectLoot && (spec.items.length > 0 || spec.blocks.length > 0) ? 'LOOT_MODIFIERS.register(bus);' : ''}
    ${spec.mobs.length ? 'ENTITIES.register(bus);' : ''}
    ${spec.modGuis.length ? 'MENUS.register(bus);' : ''}
    bus.addListener(this::addCreative);
    ${spec.mobs.length ? 'bus.addListener(this::registerAttributes);' : ''}
    ${spec.modGuis.length > 0 || spec.commands.length > 0 ? 'MinecraftForge.EVENT_BUS.addListener(this::registerCommands);' : ''}
  }

  private void addCreative(BuildCreativeModeTabContentsEvent event) {
    if (event.getTabKey() == CreativeModeTabs.INGREDIENTS) {
${creativeIngredients}
${forgeBlockCreative(spec)}
    }
    ${
      combatItems.length
        ? `if (event.getTabKey() == CreativeModeTabs.COMBAT) {
${creativeCombat}
    }`
        : ''
    }
  }

  ${
    spec.mobs.length
      ? `private void registerAttributes(EntityAttributeCreationEvent event) {
${attrRegs}
  }`
      : ''
  }

${forgeLikeCommandMethod(spec)}
}
`
  })

  files.push(...planForgeWeaponFiles(spec, packagePath))
  files.push(...planEntityFiles(spec, packagePath))
  if (spec.mobs.length > 0) {
    const clientStyle = forgeLikeClientStyle('forge', pins.minecraft)
    files.push(...planForgeLikeEntityClientFiles(spec, packagePath, 'forge', clientStyle))
    files.push({
      relativePath: `src/main/resources/assets/${spec.modId}/textures/entity/preset_mob.png`,
      encoding: 'binary',
      contents: placeholderEntityPng()
    })
    files.push({
      relativePath: 'ENTITY_RENDERING.md',
      encoding: 'utf8',
      contents: forgeLikeEntityRenderingNote('forge', pins.minecraft, clientStyle)
    })
    files.push({
      relativePath: 'SPAWNS.md',
      encoding: 'utf8',
      contents: fabricSpawnDoc(spec)
    })
    files.push(...planBiomeModifierFiles(spec, 'forge'))
  }

  const lang: Record<string, string> = { [`itemGroup.${spec.modId}`]: spec.displayName }
  for (const item of spec.items) {
    lang[`item.${spec.modId}.${item.id}`] = item.displayName
  }
  Object.assign(lang, blockLangEntries(spec))
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
      contents: item.modelStyle
        ? itemModelJson(spec.modId, item)
        : itemModelJson(spec.modId, { ...item, modelStyle: 'generated', layer1: false })
    })
  }

  files.push(...planRecipeFiles(spec))
  files.push(...planConfigFiles(spec, packagePath, 'forge'))
  files.push(...planBlockAssetFiles(spec))
  files.push(...planBlockDocs(spec, 'forge'))
  files.push(...planOreFeatureJson(spec))
  files.push(...planOreBiomeModifiers(spec, 'forge'))
  files.push(...planEntityLootFiles(spec))
  if (injectLoot) {
    files.push(...planItemLootFiles(spec))
    files.push(...planForgeLikeLootModifierFiles(spec, packagePath, 'forge'))
  }
  files.push(...planLootDocs(spec, injectLoot))
  files.push(...planWorldgenDocs(spec, 'forge'))
  files.push(...planForgeLikeMenuFiles(spec, packagePath, 'forge'))

  files.push({
    relativePath: 'INSTALL.md',
    encoding: 'utf8',
    contents: [
      `# Install ${spec.displayName}`,
      '',
      `Forge ${pins.minecraft} · Forge ${pins.forgeVersion} · Java ${pins.java}`,
      '',
      'This project is **Forge only**. It is not a NeoForge mod.',
      '',
      '1. Install Minecraft ' + pins.minecraft + ' and the official Forge installer.',
      '2. Build with `./gradlew build`, then copy `build/libs/' + spec.modId + '-1.0.0.jar` into `.minecraft/mods`.',
      '3. Optional: export a resource pack (pack.png + layer1 when painted) from the app.',
      spec.modGuis.length > 0
        ? '4. In-game, run `/opencustommenu [id]` to open a preview container. Client clicks are untrusted; the server menu validates slots and refuses illegal transfers.'
        : '4. Accept the Minecraft EULA yourself. CraftStudio never distributes game files.',
      spec.modGuis.length > 0
        ? '5. Accept the Minecraft EULA yourself. CraftStudio never distributes game files.'
        : '',
      spec.mobs.length > 0
        ? `Summon a preset mob with \`/summon ${spec.modId}:${spec.mobs[0]!.id}\`. See ENTITY_RENDERING.md and SPAWNS.md. Presets expand into a capped goal list (max 5).`
        : '',
      spec.blocks.length > 0
        ? 'Custom blocks are cube_all or pillar (axis), plus optional slab/stairs. Paint a block texture in Assets. See BLOCKS.md and CONFIG.md.'
        : '',
      injectLoot
        ? 'Chest bonus loot is injected via a Forge global loot modifier into four allowlisted vanilla chests. See LOOT.md.'
        : spec.items.length > 0
          ? 'Chest bonus loot is off unless enableChestLoot is explicitly requested.'
          : '',
      needsForgeWeaponCode(spec)
        ? 'Weapon smash / Life Steal / shockwave / terrain are generated as Forge 1.21.1 Java. See WEAPON_REQUIREMENTS.md. Compile and in-game runtime are separate statuses.'
        : '',
      '',
      '## Permission nodes',
      '',
      ...spec.commands.map(
        (command) =>
          `- \`/${command.name}\` → \`${command.permission?.trim() || defaultCommandPermission(spec.modId, command.name)}\` (Forge uses permission level ${command.permission?.trim() ? '2' : '0'})`
      ),
      spec.commands.length === 0 ? '- No extra spec commands in this project. `/opencustommenu` is registered when menus exist.' : '',
      '',
      'Compile success is not a Tested compatibility row.',
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
      `Generated by CraftStudio Local for **Forge ${pins.minecraft}** (Forge ${pins.forgeVersion}, ForgeGradle ${pins.forgeGradle}).`,
      '**Not NeoForge.** Do not treat this as NeoForge compatibility.',
      '',
      '```bash',
      './gradlew build',
      '```',
      ''
    ].join('\n')
  })

  return files
}
