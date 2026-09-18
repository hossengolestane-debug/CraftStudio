import { AppError } from '../../../shared/errors'
import { itemModelJson } from '../../../shared/itemModels'
import { neoforgePinsFor, type NeoForgeVersionPins } from '../../../shared/platformPins'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import type { ProjectManifest } from '../../../shared/types'
import {
  forgeLikeClientStyle,
  forgeLikeEntityRenderingNote,
  planForgeLikeEntityClientFiles
} from '../entities/forgeLikeClient'
import { defaultCommandPermission } from '../../../shared/spawn'
import { fabricSpawnDoc, placeholderEntityPng } from '../fabric/extras'
import { isHostileMob, mojangGoalBlock, mojangParent } from '../mobs/presets'
import { forgeLikeCommandMethod, forgeLikeMenuFields, planForgeLikeMenuFiles } from '../modgui/forgeLike'
import { mojangItemProperties, mojangNeedsAttributeImports } from '../items/settings'
import {
  blockLangEntries,
  forgeBlockCreative,
  forgeNeedsRotatedPillar,
  forgeNeedsSlab,
  forgeNeedsStairs,
  neoBlockRegs,
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

function itemRegistrations(spec: ProjectSpec): string {
  return spec.items
    .map((item) => {
      const constant = toConstName(item.id)
      return `  public static final DeferredItem<Item> ${constant} = ITEMS.registerSimpleItem(
    "${item.id}",
    ${mojangItemProperties(item)}
  );`
    })
    .join('\n\n')
}

function creativeAccepts(spec: ProjectSpec): string {
  return spec.items.map((item) => `      event.accept(${toConstName(item.id)});`).join('\n')
}

function entityRegistrations(spec: ProjectSpec, pins: NeoForgeVersionPins): string {
  return spec.mobs
    .map((mob) => {
      const cls = entityClassName(mob.id)
      const size = mob.appearance.model === 'quadruped' ? '0.9f, 0.9f' : '0.6f, 1.95f'
      const category = isHostileMob(mob) ? 'MobCategory.MONSTER' : 'MobCategory.CREATURE'
      const buildCall =
        pins.entityTypeBuild === 'resource_key'
          ? `build(ResourceKey.create(Registries.ENTITY_TYPE, ResourceLocation.fromNamespaceAndPath(MOD_ID, "${mob.id}")))`
          : `build("${mob.id}")`
      return `  public static final DeferredHolder<EntityType<?>, EntityType<${cls}>> ${toConstName(mob.id)} = ENTITIES.register("${mob.id}",
    () -> EntityType.Builder.of(${cls}::new, ${category}).sized(${size}).${buildCall});`
    })
    .join('\n\n')
}

function planNeoForgeEntityFiles(spec: ProjectSpec, packagePath: string): PlannedFile[] {
  return spec.mobs.map((mob) => {
    const cls = entityClassName(mob.id)
    const parent = mojangParent(mob)
    const animalBits =
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
    return {
      relativePath: `src/main/java/${packagePath}/${cls}.java`,
      encoding: 'utf8' as const,
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

  ${animalBits}
}
`
    }
  })
}

function mainJava(spec: ProjectSpec, pins: NeoForgeVersionPins): string {
  const emitEntities = pins.entityRegistration && spec.mobs.length > 0
  const attrRegs = spec.mobs
    .map((mob) => `      event.put(${toConstName(mob.id)}.get(), ${entityClassName(mob.id)}.createAttributes().build());`)
    .join('\n')
  const needsRegistries = emitEntities || spec.modGuis.length > 0
  const needsHolder = emitEntities || spec.modGuis.length > 0
  const needsCommands = spec.modGuis.length > 0 || spec.commands.length > 0
  const hasLoot = spec.items.length > 0 || spec.blocks.length > 0
  return `package ${spec.packageName};

import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
${mojangNeedsAttributeImports(spec.items) ? `import net.minecraft.world.entity.EquipmentSlotGroup;
import net.minecraft.world.entity.ai.attributes.AttributeModifier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.item.component.ItemAttributeModifiers;
import net.minecraft.resources.ResourceLocation;` : ''}
${needsRegistries ? 'import net.minecraft.core.registries.Registries;' : ''}
${emitEntities ? `import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.neoforged.neoforge.event.entity.EntityAttributeCreationEvent;` : ''}
${spec.modGuis.length ? `import net.minecraft.world.inventory.MenuType;
import net.neoforged.neoforge.common.extensions.IMenuTypeExtension;` : ''}
${needsCommands ? `import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;` : ''}
${needsHolder || hasLoot ? 'import net.neoforged.neoforge.registries.DeferredHolder;' : ''}
${spec.blocks.length ? `import net.minecraft.world.item.BlockItem;
import net.minecraft.world.level.block.Block;
${forgeNeedsRotatedPillar(spec) ? 'import net.minecraft.world.level.block.RotatedPillarBlock;' : ''}
${forgeNeedsSlab(spec) ? 'import net.minecraft.world.level.block.SlabBlock;' : ''}
${forgeNeedsStairs(spec) ? 'import net.minecraft.world.level.block.StairBlock;' : ''}
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.neoforged.neoforge.registries.DeferredBlock;` : ''}
${hasLoot ? `import com.mojang.serialization.MapCodec;
import net.neoforged.neoforge.common.loot.IGlobalLootModifier;
import net.neoforged.neoforge.registries.NeoForgeRegistries;` : ''}
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.common.Mod;
import net.neoforged.neoforge.event.BuildCreativeModeTabContentsEvent;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

@Mod(${spec.mainClass}.MOD_ID)
public class ${spec.mainClass} {
  public static final String MOD_ID = "${javaEscape(spec.modId)}";
  public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(MOD_ID);
${spec.blocks.length ? `  public static final DeferredRegister.Blocks BLOCKS = DeferredRegister.createBlocks(MOD_ID);` : ''}
${hasLoot ? `  public static final DeferredRegister<MapCodec<? extends IGlobalLootModifier>> LOOT_MODIFIERS = DeferredRegister.create(NeoForgeRegistries.GLOBAL_LOOT_MODIFIER_SERIALIZERS, MOD_ID);` : ''}
${emitEntities ? `  public static final DeferredRegister<EntityType<?>> ENTITIES = DeferredRegister.create(Registries.ENTITY_TYPE, MOD_ID);` : ''}
${spec.modGuis.length ? forgeLikeMenuFields(spec, 'neoforge') : ''}

${itemRegistrations(spec)}
${spec.blocks.length ? `\n${neoBlockRegs(spec)}` : ''}
${hasLoot ? `  public static final DeferredHolder<MapCodec<? extends IGlobalLootModifier>, MapCodec<AddBonusChestModifier>> ADD_BONUS_CHEST = LOOT_MODIFIERS.register("add_bonus_chest", () -> AddBonusChestModifier.CODEC);` : ''}
${emitEntities ? `\n${entityRegistrations(spec, pins)}` : ''}

  public ${spec.mainClass}(IEventBus modEventBus) {
    CraftStudioConfig.load();
    ${spec.blocks.length ? 'BLOCKS.register(modEventBus);' : ''}
    ITEMS.register(modEventBus);
    ${hasLoot ? 'LOOT_MODIFIERS.register(modEventBus);' : ''}
    ${emitEntities ? 'ENTITIES.register(modEventBus);' : ''}
    ${spec.modGuis.length ? 'MENUS.register(modEventBus);' : ''}
    modEventBus.addListener(this::addCreative);
    ${emitEntities ? 'modEventBus.addListener(this::registerAttributes);' : ''}
    ${needsCommands ? 'NeoForge.EVENT_BUS.addListener(this::registerCommands);' : ''}
  }

  private void addCreative(BuildCreativeModeTabContentsEvent event) {
    if (event.getTabKey() == CreativeModeTabs.INGREDIENTS) {
${creativeAccepts(spec)}
${forgeBlockCreative(spec)}
    }
  }

  ${
    emitEntities
      ? `private void registerAttributes(EntityAttributeCreationEvent event) {
${attrRegs}
  }`
      : ''
  }

${forgeLikeCommandMethod(spec)}
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
      action: 'Create a NeoForge 1.21.1 / 1.21.4 / 1.21.8 project. Forge is a separate adapter and is not inferred from NeoForge.'
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
  Object.assign(lang, blockLangEntries(spec))
  if (pins.entityRegistration) {
    for (const mob of spec.mobs) {
      lang[`entity.${spec.modId}.${mob.id}`] = mob.displayName
    }
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

  files.push({
    relativePath: `src/main/java/${packagePath}/${spec.mainClass}.java`,
    encoding: 'utf8',
    contents: mainJava(spec, pins)
  })
  files.push(...planRecipeFiles(spec))
  files.push(...planConfigFiles(spec, packagePath, 'neoforge'))
  files.push(...planBlockAssetFiles(spec))
  files.push(...planBlockDocs(spec, 'neoforge'))
  files.push(...planOreFeatureJson(spec))
  files.push(...planOreBiomeModifiers(spec, 'neoforge'))
  files.push(...planEntityLootFiles(spec))
  files.push(...planItemLootFiles(spec))
  files.push(...planLootDocs(spec, true))
  files.push(...planForgeLikeLootModifierFiles(spec, packagePath, 'neoforge'))
  files.push(...planWorldgenDocs(spec, 'neoforge'))

  if (pins.entityRegistration && spec.mobs.length > 0) {
    files.push(...planNeoForgeEntityFiles(spec, packagePath))
    const clientStyle = forgeLikeClientStyle('neoforge', pins.minecraft)
    files.push(
      ...planForgeLikeEntityClientFiles(spec, packagePath, 'neoforge', clientStyle, {
        omitEventBusSubscriberBus: pins.minecraft === '1.21.8'
      })
    )
    files.push({
      relativePath: `src/main/resources/assets/${spec.modId}/textures/entity/preset_mob.png`,
      encoding: 'binary',
      contents: placeholderEntityPng()
    })
    files.push({
      relativePath: 'ENTITY_RENDERING.md',
      encoding: 'utf8',
      contents: forgeLikeEntityRenderingNote('neoforge', pins.minecraft, clientStyle)
    })
    files.push({
      relativePath: 'SPAWNS.md',
      encoding: 'utf8',
      contents: fabricSpawnDoc(spec)
    })
    files.push(...planBiomeModifierFiles(spec, 'neoforge'))
  } else if (spec.mobs.length > 0) {
    files.push({
      relativePath: 'MOBS.md',
      encoding: 'utf8',
      contents: [
        '# Custom mobs not emitted',
        '',
        `NeoForge entity registration is pinned for 1.21.1 only. This project is ${pins.minecraft}.`,
        'Items and GUIs still generate. Spec mobs stay in craftstudio.spec.json until a later pin.',
        'This is not a Forge compatibility claim.',
        ''
      ].join('\n')
    })
  }

  files.push(
    ...planForgeLikeMenuFiles(spec, packagePath, 'neoforge', {
      omitEventBusSubscriberBus: pins.minecraft === '1.21.8'
    })
  )

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
      '4. Optional: export a resource pack (pack.png + layer1 when painted) from the app.',
      spec.modGuis.length > 0
        ? '5. In-game, run `/opencustommenu [id]` to open a preview container. Client clicks are untrusted; the server menu validates slots and refuses illegal transfers.'
        : '5. Accept the Minecraft EULA yourself. CraftStudio never distributes game files or bypasses auth.',
      spec.modGuis.length > 0
        ? '6. Accept the Minecraft EULA yourself. CraftStudio never distributes game files or bypasses auth.'
        : '',
      spec.mobs.length > 0 && pins.entityRegistration
        ? `Summon a preset mob with \`/summon ${spec.modId}:${spec.mobs[0]!.id}\`. See ENTITY_RENDERING.md and SPAWNS.md. Presets expand into a capped goal list (max 5).`
        : '',
      spec.blocks.length > 0
        ? 'Custom blocks are cube_all or pillar (axis), plus optional slab/stairs. Paint a block texture in Assets. See BLOCKS.md and CONFIG.md.'
        : '',
      spec.items.length > 0
        ? 'Chest bonus loot is injected via a NeoForge global loot modifier into four allowlisted vanilla chests. See LOOT.md.'
        : '',
      '',
      '## Permission nodes',
      '',
      ...spec.commands.map(
        (command) =>
          `- \`/${command.name}\` → \`${command.permission?.trim() || defaultCommandPermission(spec.modId, command.name)}\` (NeoForge uses permission level ${command.permission?.trim() ? '2' : '0'})`
      ),
      spec.commands.length === 0 ? '- No extra spec commands in this project. `/opencustommenu` is registered when menus exist.' : '',
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
