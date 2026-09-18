import type { FabricItemRegistration } from '../../../shared/platformPins'
import { encodePngRgba } from '../../../shared/png'
import { defaultCommandPermission, minecraftBiomeId, yarnBiomeKey } from '../../../shared/spawn'
import type { ProjectSpec, SpecModGui } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import { isHostilePreset, yarnGoalBlock, yarnParent } from '../mobs/presets'
import { entityClassName, fabricHandlerClass, fabricScreenClass, menuFieldName, menuRegistryName } from '../naming'
import type { PlannedFile } from '../types'
import { javaEscape } from '../wrapper'

export { entityClassName }

export type FabricRendererStyle = 'classic_living' | 'render_state' | 'render_state_rooted'

export function fabricRendererStyle(minecraftVersion: string): FabricRendererStyle {
  if (minecraftVersion === '1.21' || minecraftVersion === '1.21.1') {
    return 'classic_living'
  }
  return 'render_state_rooted'
}

export function placeholderEntityPng(): Buffer {
  const width = 64
  const height = 32
  const pixels = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const x = i % width
    const y = Math.floor(i / width)
    pixels[i * 4] = 70 + (x % 8)
    pixels[i * 4 + 1] = 90 + (y % 6)
    pixels[i * 4 + 2] = 60
    pixels[i * 4 + 3] = 255
  }
  return encodePngRgba(width, height, pixels)
}

export function planFabricMobFiles(
  spec: ProjectSpec,
  packagePath: string,
  classic: boolean
): PlannedFile[] {
  return spec.mobs.map((mob) => {
    const cls = entityClassName(mob.id)
    const parent = yarnParent(mob)
    return {
      relativePath: `src/main/java/${packagePath}/${cls}.java`,
      encoding: 'utf8' as const,
      contents: `package ${spec.packageName};

import ${parent.importName};
import net.minecraft.entity.EntityType;
import net.minecraft.entity.ai.goal.ActiveTargetGoal;
import net.minecraft.entity.ai.goal.FleeEntityGoal;
import net.minecraft.entity.ai.goal.PounceAtTargetGoal;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.entity.ai.goal.RevengeGoal;
import net.minecraft.entity.ai.goal.SwimGoal;
import net.minecraft.entity.ai.goal.WanderAroundFarGoal;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.world.World;

public class ${cls} extends ${parent.extend} {
  public ${cls}(EntityType<? extends ${cls}> type, World world) {
    super(type, world);
  }

  public static DefaultAttributeContainer.Builder createAttributes() {
    return MobEntity.createMobAttributes()
      .add(EntityAttributes.${classic ? 'GENERIC_MAX_HEALTH' : 'MAX_HEALTH'}, ${mob.health}d)
      .add(EntityAttributes.${classic ? 'GENERIC_MOVEMENT_SPEED' : 'MOVEMENT_SPEED'}, ${mob.movementSpeed}d)
      .add(EntityAttributes.${classic ? 'GENERIC_ATTACK_DAMAGE' : 'ATTACK_DAMAGE'}, ${mob.attackDamage}d);
  }

  @Override
  protected void initGoals() {
    this.goalSelector.add(0, new SwimGoal(this));
${yarnGoalBlock(mob)}    this.goalSelector.add(3, new LookAtEntityGoal(this, PlayerEntity.class, 8.0f));
  }

  ${
    parent.extend === 'PassiveEntity'
      ? `@Override
  public ${cls} createChild(ServerWorld world, net.minecraft.entity.passive.PassiveEntity other) {
    return null;
  }`
      : ''
  }
}
`
    }
  })
}

export function fabricEntityFields(spec: ProjectSpec, style: FabricItemRegistration): string {
  return spec.mobs
    .map((mob) => {
      const cls = entityClassName(mob.id)
      const constant = toConstName(mob.id)
      const group = isHostilePreset(mob.preset) ? 'SpawnGroup.MONSTER' : 'SpawnGroup.CREATURE'
      const size = mob.appearance.model === 'quadruped' ? '0.9f, 0.9f' : '0.6f, 1.95f'
      if (style === 'registry_key') {
        return `  public static final RegistryKey<EntityType<?>> ${constant}_KEY = RegistryKey.of(
    RegistryKeys.ENTITY_TYPE,
    Identifier.of(MOD_ID, "${mob.id}")
  );

  public static final EntityType<${cls}> ${constant} = Registry.register(
    Registries.ENTITY_TYPE,
    ${constant}_KEY,
    EntityType.Builder.create(${cls}::new, ${group}).dimensions(${size}).build(${constant}_KEY)
  );`
      }
      return `  public static final EntityType<${cls}> ${constant} = Registry.register(
    Registries.ENTITY_TYPE,
    Identifier.of(MOD_ID, "${mob.id}"),
    EntityType.Builder.create(${cls}::new, ${group}).dimensions(${size}).build()
  );`
    })
    .join('\n\n')
}

export function fabricAttributeLines(spec: ProjectSpec): string {
  return spec.mobs
    .map((mob) => `    FabricDefaultAttributeRegistry.register(${toConstName(mob.id)}, ${entityClassName(mob.id)}.createAttributes());`)
    .join('\n')
}

export function fabricSpawnInit(spec: ProjectSpec): string {
  const lines = spec.mobs
    .filter((mob) => mob.spawn.enabled && mob.spawn.biomes.length > 0)
    .map((mob) => {
      const keys = mob.spawn.biomes.map((biome) => `BiomeKeys.${yarnBiomeKey(biome)}`).join(', ')
      const group = isHostilePreset(mob.preset) ? 'SpawnGroup.MONSTER' : 'SpawnGroup.CREATURE'
      return `    BiomeModifications.addSpawn(BiomeSelectors.includeByKey(${keys}), ${group}, ${toConstName(mob.id)}, ${mob.spawn.weight}, ${mob.spawn.minGroup}, ${mob.spawn.maxGroup});`
    })
  return lines.join('\n')
}

export function fabricWorldgenInit(spec: ProjectSpec): string {
  return spec.worldgen
    .map((entry) => {
      const biomes = entry.biomes.length
        ? `BiomeSelectors.includeByKey(${entry.biomes.map((biome) => `BiomeKeys.${yarnBiomeKey(biome)}`).join(', ')})`
        : 'BiomeSelectors.foundInOverworld()'
      return `    BiomeModifications.addFeature(${biomes}, GenerationStep.Feature.UNDERGROUND_ORES, RegistryKey.of(RegistryKeys.PLACED_FEATURE, Identifier.of(MOD_ID, "${entry.id}")));`
    })
    .join('\n')
}

function customSlotCount(gui: SpecModGui): number {
  return Math.max(1, gui.widgets.filter((widget) => widget.kind === 'slot').length)
}

function fabricHandlerJava(spec: ProjectSpec, gui: SpecModGui): string {
  const handler = fabricHandlerClass(gui.id)
  const field = menuFieldName(gui.id)
  const slots = customSlotCount(gui)
  const dataCount = Math.max(1, gui.dataSlots.length)
  const slotAdds = Array.from({ length: slots }, (_, index) => {
    const widget = gui.widgets.filter((entry) => entry.kind === 'slot')[index]
    const x = widget?.x ?? 80
    const y = widget?.y ?? 60
    return `    this.addSlot(new Slot(this.container, ${index}, ${x}, ${y}) {
      @Override
      public boolean canInsert(ItemStack stack) {
        return !stack.isEmpty() && stack.getCount() <= stack.getMaxCount();
      }
    });`
  }).join('\n')
  const dataInits = gui.dataSlots
    .map((slot, index) => `    this.data.set(${index}, ${slot.initial});`)
    .join('\n')
  return `package ${spec.packageName};

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.screen.ArrayPropertyDelegate;
import net.minecraft.screen.PropertyDelegate;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.slot.Slot;

/**
 * Server-side container for "${javaEscape(gui.title)}".
 * Client clicks are not trusted. Data slots are server-owned PropertyDelegate values.
 */
public class ${handler} extends ScreenHandler {
  private static final int CUSTOM_SLOTS = ${slots};
  private final SimpleInventory container = new SimpleInventory(CUSTOM_SLOTS);
  private final PropertyDelegate data = new ArrayPropertyDelegate(${dataCount});

  public ${handler}(int syncId, PlayerInventory inventory) {
    super(${spec.mainClass}.${field}, syncId);
${slotAdds}
    for (int row = 0; row < 3; row++) {
      for (int col = 0; col < 9; col++) {
        this.addSlot(new Slot(inventory, col + row * 9 + 9, 8 + col * 18, 84 + row * 18));
      }
    }
    for (int col = 0; col < 9; col++) {
      this.addSlot(new Slot(inventory, col, 8 + col * 18, 142));
    }
    this.addProperties(this.data);
${dataInits || `    this.data.set(0, 0);`}
  }

  public int getSyncedData(int index) {
    return this.data.get(index);
  }

  @Override
  public boolean canUse(PlayerEntity player) {
    return true;
  }

  @Override
  public ItemStack quickMove(PlayerEntity player, int index) {
    Slot slot = this.slots.get(index);
    if (slot == null || !slot.hasStack()) {
      return ItemStack.EMPTY;
    }
    ItemStack stack = slot.getStack();
    ItemStack original = stack.copy();
    boolean moved;
    if (index < CUSTOM_SLOTS) {
      moved = this.insertItem(stack, CUSTOM_SLOTS, this.slots.size(), true);
    } else {
      moved = this.insertItem(stack, 0, CUSTOM_SLOTS, false);
    }
    if (!moved) {
      return ItemStack.EMPTY;
    }
    if (stack.isEmpty()) {
      slot.setStack(ItemStack.EMPTY);
    } else {
      slot.markDirty();
    }
    return original;
  }

  @Override
  public void onClosed(PlayerEntity player) {
    super.onClosed(player);
    this.dropInventory(player, this.container);
  }
}
`
}

function fabricGhostStack(spec: ProjectSpec, itemId: string): string {
  if (itemId.startsWith('minecraft:')) {
    return `new ItemStack(Items.${itemId.slice('minecraft:'.length).toUpperCase()})`
  }
  return `new ItemStack(${spec.mainClass}.${toConstName(itemId)})`
}

function fabricScreenJava(spec: ProjectSpec, gui: SpecModGui): string {
  const screen = fabricScreenClass(gui.id)
  const handler = fabricHandlerClass(gui.id)
  const widgets = gui.widgets
    .map((widget) => {
      if (widget.kind === 'label') {
        return `    context.drawText(this.textRenderer, "${javaEscape(widget.text || widget.id)}", ${widget.x}, ${widget.y}, 0x404040, false);`
      }
      if (widget.kind === 'button') {
        return `    // Button "${javaEscape(widget.text || widget.id)}" at ${widget.x},${widget.y} action=${widget.action} — wired as a close control in init().`
      }
      return `    // Slot preview at ${widget.x},${widget.y}. Server must validate item movement; this screen does not trust the client.`
    })
    .join('\n')
  const dataLabels = gui.dataSlots
    .map(
      (slot, index) =>
        `    context.drawText(this.textRenderer, "${javaEscape(slot.id)}=" + this.handler.getSyncedData(${index}), 8, ${18 + index * 10}, 0x305030, false);`
    )
    .join('\n')
  const firstSlot = gui.widgets.find((widget) => widget.kind === 'slot')
  const ghost = gui.dataSlots.find((slot) => slot.ghostItemId)
  const ghostDraw =
    ghost?.ghostItemId && firstSlot
      ? `    if (!this.handler.getSlot(0).hasStack()) {
      context.drawItem(${fabricGhostStack(spec, ghost.ghostItemId)}, this.x + ${firstSlot.x}, this.y + ${firstSlot.y});
    }`
      : ''
  const needsItems = Boolean(ghost?.ghostItemId)
  return `package ${spec.packageName};

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.entity.player.PlayerInventory;
${needsItems ? 'import net.minecraft.item.ItemStack;\nimport net.minecraft.item.Items;\n' : ''}import net.minecraft.text.Text;

/**
 * Client preview for "${javaEscape(gui.title)}" (${gui.width}x${gui.height}).
 * Ghost items are display-only. Data slot numbers come from the server PropertyDelegate.
 */
public class ${screen} extends HandledScreen<${handler}> {
  public ${screen}(${handler} handler, PlayerInventory inventory, Text title) {
    super(handler, inventory, title);
    this.backgroundWidth = ${gui.width};
    this.backgroundHeight = ${gui.height};
  }

  @Override
  protected void init() {
    super.init();
    this.addDrawableChild(ButtonWidget.builder(Text.literal("Close"), button -> this.close())
      .dimensions(this.x + 48, this.y + ${Math.max(20, gui.height - 36)}, 80, 20)
      .build());
  }

  @Override
  protected void drawBackground(DrawContext context, float delta, int mouseX, int mouseY) {
    context.fill(this.x, this.y, this.x + this.backgroundWidth, this.y + this.backgroundHeight, 0xC0101010);
${widgets}
${dataLabels}
${ghostDraw}
  }
}
`
}

export function planFabricGuiFiles(spec: ProjectSpec, packagePath: string): PlannedFile[] {
  return spec.modGuis.flatMap((gui) => [
    {
      relativePath: `src/main/java/${packagePath}/${fabricHandlerClass(gui.id)}.java`,
      encoding: 'utf8' as const,
      contents: fabricHandlerJava(spec, gui)
    },
    {
      relativePath: `src/main/java/${packagePath}/${fabricScreenClass(gui.id)}.java`,
      encoding: 'utf8' as const,
      contents: fabricScreenJava(spec, gui)
    }
  ])
}

export function planFabricClientFiles(
  spec: ProjectSpec,
  packagePath: string,
  _style: FabricRendererStyle
): PlannedFile[] {
  if (spec.modGuis.length === 0 && spec.mobs.length === 0) {
    return []
  }
  return [
    {
      relativePath: `src/main/java/${packagePath}/${spec.mainClass}Client.java`,
      encoding: 'utf8',
      contents: fabricClientJava(spec)
    }
  ]
}

function fabricClientJava(spec: ProjectSpec): string {
  const rendererLines = fabricClientRendererLines(spec)
  const imports = ['import net.fabricmc.api.ClientModInitializer;']
  if (spec.modGuis.length > 0) {
    imports.push('import net.minecraft.client.gui.screen.ingame.HandledScreens;')
  }
  if (spec.mobs.length > 0) {
    imports.push('import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;')
    imports.push('import net.fabricmc.fabric.api.client.rendering.v1.EntityModelLayerRegistry;')
  }
  const layerLine =
    spec.mobs.length > 0
      ? `    EntityModelLayerRegistry.registerModelLayer(CraftStudioMobModel.LAYER, CraftStudioMobModel::getTexturedModelData);`
      : ''
  const screenLines = spec.modGuis
    .map(
      (gui) =>
        `    HandledScreens.register(${spec.mainClass}.${menuFieldName(gui.id)}, ${fabricScreenClass(gui.id)}::new);`
    )
    .join('\n')
  return `package ${spec.packageName};

${imports.join('\n')}

public class ${spec.mainClass}Client implements ClientModInitializer {
  @Override
  public void onInitializeClient() {
${screenLines}
${layerLine}
${rendererLines}
  }
}
`
}

export function fabricMenuField(spec: ProjectSpec, style: FabricItemRegistration): string {
  if (spec.modGuis.length === 0) {
    return ''
  }
  return spec.modGuis
    .map((gui) => {
      const handler = fabricHandlerClass(gui.id)
      const field = menuFieldName(gui.id)
      const registry = menuRegistryName(gui.id)
      if (style === 'registry_key') {
        return `  public static final RegistryKey<ScreenHandlerType<?>> ${field}_KEY = RegistryKey.of(
    RegistryKeys.SCREEN_HANDLER,
    Identifier.of(MOD_ID, "${registry}")
  );

  public static final ScreenHandlerType<${handler}> ${field} = Registry.register(
    Registries.SCREEN_HANDLER,
    ${field}_KEY,
    new ScreenHandlerType<>(${handler}::new, FeatureFlags.VANILLA_FEATURES)
  );`
      }
      return `  public static final ScreenHandlerType<${handler}> ${field} = Registry.register(
    Registries.SCREEN_HANDLER,
    Identifier.of(MOD_ID, "${registry}"),
    new ScreenHandlerType<>(${handler}::new, FeatureFlags.VANILLA_FEATURES)
  );`
    })
    .join('\n\n')
}

function classicMobModelJava(spec: ProjectSpec): string {
  return `package ${spec.packageName};

import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.entity.model.EntityModel;
import net.minecraft.client.render.entity.model.EntityModelLayer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.LivingEntity;
import net.minecraft.util.Identifier;

/**
 * Dedicated cube model. Vanilla model classes are typed to vanilla entities and will not compile here.
 * This is not a Minecraft-verified custom model.
 */
public class CraftStudioMobModel<T extends LivingEntity> extends EntityModel<T> {
  public static final EntityModelLayer LAYER = new EntityModelLayer(Identifier.of(${spec.mainClass}.MOD_ID, "preset_mob"), "main");
  private final ModelPart root;

  public CraftStudioMobModel(ModelPart root) {
    this.root = root;
  }

  public static TexturedModelData getTexturedModelData() {
    ModelData data = new ModelData();
    var root = data.getRoot();
    root.addChild("body", ModelPartBuilder.create().uv(0, 0).cuboid(-3.0F, 10.0F, -2.0F, 6.0F, 8.0F, 4.0F), ModelTransform.NONE);
    root.addChild("head", ModelPartBuilder.create().uv(16, 0).cuboid(-3.0F, 4.0F, -3.0F, 6.0F, 6.0F, 6.0F), ModelTransform.NONE);
    return TexturedModelData.of(data, 64, 32);
  }

  @Override
  public void setAngles(T entity, float limbAngle, float limbDistance, float animationProgress, float headYaw, float headPitch) {
  }

  @Override
  public void render(MatrixStack matrices, VertexConsumer vertices, int light, int overlay, int color) {
    this.root.render(matrices, vertices, light, overlay, color);
  }
}
`
}

function modernMobModelJava(spec: ProjectSpec, rooted: boolean): string {
  const ctor = rooted
    ? `  public CraftStudioMobModel(ModelPart root) {
    super(root);
    this.root = root;
  }`
    : `  public CraftStudioMobModel(ModelPart root) {
    this.root = root;
  }`
  const render = rooted
    ? ''
    : `
  @Override
  public void render(MatrixStack matrices, VertexConsumer vertices, int light, int overlay, int color) {
    this.root.render(matrices, vertices, light, overlay, color);
  }
`
  const extraImports = rooted
    ? ''
    : `import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.util.math.MatrixStack;
`
  return `package ${spec.packageName};

import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
${extraImports}import net.minecraft.client.render.entity.model.EntityModel;
import net.minecraft.client.render.entity.model.EntityModelLayer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/**
 * Visible 1.21.2+ cube model typed to LivingEntityRenderState.
 * Vanilla model classes are typed to vanilla entities and are not used.
 */
public class CraftStudioMobModel extends EntityModel<LivingEntityRenderState> {
  public static final EntityModelLayer LAYER = new EntityModelLayer(Identifier.of(${spec.mainClass}.MOD_ID, "preset_mob"), "main");
  private final ModelPart root;

${ctor}

  public static TexturedModelData getTexturedModelData() {
    ModelData data = new ModelData();
    var root = data.getRoot();
    root.addChild("body", ModelPartBuilder.create().uv(0, 0).cuboid(-3.0F, 10.0F, -2.0F, 6.0F, 8.0F, 4.0F), ModelTransform.NONE);
    root.addChild("head", ModelPartBuilder.create().uv(16, 0).cuboid(-3.0F, 4.0F, -3.0F, 6.0F, 6.0F, 6.0F), ModelTransform.NONE);
    return TexturedModelData.of(data, 64, 32);
  }

  @Override
  public void setAngles(LivingEntityRenderState state) {
  }
${render}}
`
}

function classicRendererJava(spec: ProjectSpec, mobId: string): string {
  const cls = entityClassName(mobId)
  return `package ${spec.packageName};

import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.util.Identifier;

public class ${cls}Renderer extends MobEntityRenderer<${cls}, CraftStudioMobModel<${cls}>> {
  private static final Identifier TEXTURE = Identifier.of(${spec.mainClass}.MOD_ID, "textures/entity/preset_mob.png");

  public ${cls}Renderer(EntityRendererFactory.Context context) {
    super(context, new CraftStudioMobModel<>(context.getPart(CraftStudioMobModel.LAYER)), 0.5f);
  }

  @Override
  public Identifier getTexture(${cls} entity) {
    return TEXTURE;
  }
}
`
}

function modernRendererJava(spec: ProjectSpec, mobId: string): string {
  const cls = entityClassName(mobId)
  return `package ${spec.packageName};

import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.LivingEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import net.minecraft.util.Identifier;

/**
 * Visible 1.21.2+ LivingEntityRenderer + cube model. This is not a Minecraft-verified custom model.
 */
public class ${cls}Renderer extends LivingEntityRenderer<${cls}, LivingEntityRenderState, CraftStudioMobModel> {
  private static final Identifier TEXTURE = Identifier.of(${spec.mainClass}.MOD_ID, "textures/entity/preset_mob.png");

  public ${cls}Renderer(EntityRendererFactory.Context context) {
    super(context, new CraftStudioMobModel(context.getPart(CraftStudioMobModel.LAYER)), 0.5f);
  }

  @Override
  public LivingEntityRenderState createRenderState() {
    return new LivingEntityRenderState();
  }

  @Override
  public Identifier getTexture(LivingEntityRenderState state) {
    return TEXTURE;
  }
}
`
}

export function planFabricEntityRenderers(
  spec: ProjectSpec,
  packagePath: string,
  style: FabricRendererStyle
): PlannedFile[] {
  if (spec.mobs.length === 0) {
    return []
  }
  const files: PlannedFile[] = [
    {
      relativePath: `src/main/java/${packagePath}/CraftStudioMobModel.java`,
      encoding: 'utf8',
      contents:
        style === 'classic_living'
          ? classicMobModelJava(spec)
          : modernMobModelJava(spec, style === 'render_state_rooted')
    }
  ]
  for (const mob of spec.mobs) {
    files.push({
      relativePath: `src/main/java/${packagePath}/${entityClassName(mob.id)}Renderer.java`,
      encoding: 'utf8',
      contents:
        style === 'classic_living' ? classicRendererJava(spec, mob.id) : modernRendererJava(spec, mob.id)
    })
  }
  return files
}

export function fabricClientRendererLines(spec: ProjectSpec): string {
  if (spec.mobs.length === 0) {
    return ''
  }
  return spec.mobs
    .map(
      (mob) =>
        `    EntityRendererRegistry.register(${spec.mainClass}.${toConstName(mob.id)}, ${entityClassName(mob.id)}Renderer::new);`
    )
    .join('\n')
}

export function fabricCommandBlocks(spec: ProjectSpec): string {
  const specCommands = spec.commands.map((command) => {
    const permission = command.permission?.trim() || defaultCommandPermission(spec.modId, command.name)
    const level = command.permission?.trim() ? 2 : 0
    return `    dispatcher.register(CommandManager.literal("${javaEscape(command.name)}")
      .requires(source -> source.hasPermissionLevel(${level}))
      .executes(context -> {
        context.getSource().sendFeedback(() -> Text.literal("CraftStudio command /${javaEscape(command.name)} (${javaEscape(permission)})"), false);
        return 1;
      }));`
  })
  const menuIds = spec.modGuis.map((gui) => `"${javaEscape(gui.id)}"`).join(', ')
  const menuCases = spec.modGuis
    .map((gui) => {
      const handler = fabricHandlerClass(gui.id)
      return `        case "${javaEscape(gui.id)}" -> player.openHandledScreen(new SimpleNamedScreenHandlerFactory((syncId, inv, p) -> new ${handler}(syncId, inv), Text.literal("${javaEscape(gui.title)}")));`
    })
    .join('\n')
  const openMenu =
    spec.modGuis.length > 0
      ? `    dispatcher.register(CommandManager.literal("opencustommenu")
      .then(CommandManager.argument("id", StringArgumentType.word())
        .suggests((ctx, builder) -> {
          for (String id : new String[] {${menuIds}}) {
            if (id.startsWith(builder.getRemaining().toLowerCase())) {
              builder.suggest(id);
            }
          }
          return builder.buildFuture();
        })
        .executes(context -> {
          ServerPlayerEntity player = context.getSource().getPlayerOrThrow();
          String id = StringArgumentType.getString(context, "id");
          switch (id) {
${menuCases}
            default -> context.getSource().sendError(Text.literal("Unknown menu id."));
          }
          return 1;
        }))
      .executes(context -> {
        ServerPlayerEntity player = context.getSource().getPlayerOrThrow();
        player.openHandledScreen(new SimpleNamedScreenHandlerFactory((syncId, inv, p) -> new ${fabricHandlerClass(spec.modGuis[0]!.id)}(syncId, inv), Text.literal("${javaEscape(spec.modGuis[0]!.title)}")));
        return 1;
      }));`
      : ''
  return [...specCommands, openMenu].filter(Boolean).join('\n')
}

export function fabricEntityRenderingNote(minecraftVersion: string, style: FabricRendererStyle): string {
  const body =
    style === 'classic_living'
      ? `Fabric ${minecraftVersion}: a compiling custom cube model is registered with MobEntityRenderer. Vanilla model classes are typed to vanilla entities and are not used.`
      : `Fabric ${minecraftVersion}: a compiling visible LivingEntityRenderer + CraftStudioMobModel cube is registered (render-state API). Vanilla model classes are typed to vanilla entities and are not used.`
  return [
    '# Entity rendering note',
    '',
    body,
    'This is not a Minecraft-verified custom model. Summon always works. Biome spawn tables emit only when enabled on the spec.',
    ''
  ].join('\n')
}

export function fabricSpawnDoc(spec: ProjectSpec, pluginUnsupported = false): string {
  const rows = spec.mobs
    .map((mob) => {
      if (!mob.spawn.enabled || mob.spawn.biomes.length === 0) {
        return `- ${mob.id}: summon/command only (spawn table disabled or empty).`
      }
      return `- ${mob.id}: ${mob.spawn.biomes.map(minecraftBiomeId).join(', ')} weight=${mob.spawn.weight} group=${mob.spawn.minGroup}-${mob.spawn.maxGroup}`
    })
    .join('\n')
  return [
    '# Biome spawn tables',
    '',
    pluginUnsupported
      ? 'This adapter cannot register biome spawn tables. Plugin mobs stay vanilla disguises summoned by command.'
      : 'Dedicated biome spawn entries only. Ore-vein worldgen is a separate Phase 8 MVP (see WORLDGEN.md).',
    rows || '- No mobs in this spec.',
    ''
  ].join('\n')
}
