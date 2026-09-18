import type { FabricItemRegistration } from '../../../shared/platformPins'
import { encodePngRgba } from '../../../shared/png'
import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import { isHostilePreset, yarnGoalBlock, yarnParent } from '../mobs/presets'
import type { PlannedFile } from '../types'
import { javaEscape } from '../wrapper'

export function entityClassName(id: string): string {
  return id
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join('') + 'Entity'
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

export function planFabricGuiFiles(spec: ProjectSpec, packagePath: string): PlannedFile[] {
  if (spec.modGuis.length === 0) {
    return []
  }
  const screens = spec.modGuis
    .map((gui) => {
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
      return { gui, widgets }
    })
  const first = spec.modGuis[0]!
  return [
    {
      relativePath: `src/main/java/${packagePath}/ExampleScreenHandler.java`,
      encoding: 'utf8',
      contents: `package ${spec.packageName};

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.slot.Slot;

/**
 * Server-side container for "${javaEscape(first.title)}".
 * Client clicks are not trusted: slot changes must be validated here before the inventory updates.
 */
public class ExampleScreenHandler extends ScreenHandler {
  public ExampleScreenHandler(int syncId, PlayerInventory inventory) {
    super(${spec.mainClass}.EXAMPLE_MENU, syncId);
    this.addSlot(new Slot(inventory, 0, 80, 60));
    for (int row = 0; row < 3; row++) {
      for (int col = 0; col < 9; col++) {
        this.addSlot(new Slot(inventory, col + row * 9 + 9, 8 + col * 18, 84 + row * 18));
      }
    }
    for (int col = 0; col < 9; col++) {
      this.addSlot(new Slot(inventory, col, 8 + col * 18, 142));
    }
  }

  @Override
  public boolean canUse(PlayerEntity player) {
    return true;
  }

  @Override
  public ItemStack quickMove(PlayerEntity player, int index) {
    return ItemStack.EMPTY;
  }
}
`
    },
    {
      relativePath: `src/main/java/${packagePath}/ExampleScreen.java`,
      encoding: 'utf8',
      contents: `package ${spec.packageName};

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.text.Text;

/**
 * Client preview for "${javaEscape(first.title)}" (${first.width}x${first.height}).
 * This is a layout preview, not a Minecraft-verified GUI. Server-side validation lives in ExampleScreenHandler.
 */
public class ExampleScreen extends HandledScreen<ExampleScreenHandler> {
  public ExampleScreen(ExampleScreenHandler handler, PlayerInventory inventory, Text title) {
    super(handler, inventory, title);
    this.backgroundWidth = ${first.width};
    this.backgroundHeight = ${first.height};
  }

  @Override
  protected void init() {
    super.init();
    this.addDrawableChild(ButtonWidget.builder(Text.literal("Close"), button -> this.close())
      .dimensions(this.x + 48, this.y + ${Math.max(20, first.height - 36)}, 80, 20)
      .build());
  }

  @Override
  protected void drawBackground(DrawContext context, float delta, int mouseX, int mouseY) {
    context.fill(this.x, this.y, this.x + this.backgroundWidth, this.y + this.backgroundHeight, 0xC0101010);
${screens[0]?.widgets ?? ''}
  }
}
`
    }
  ]
}

export function planFabricClientFiles(
  spec: ProjectSpec,
  packagePath: string,
  classic: boolean
): PlannedFile[] {
  if (spec.modGuis.length === 0 && spec.mobs.length === 0) {
    return []
  }
  return [
    {
      relativePath: `src/main/java/${packagePath}/${spec.mainClass}Client.java`,
      encoding: 'utf8',
      contents: fabricClientJava(spec, spec.modGuis.length > 0, classic)
    }
  ]
}

function fabricClientJava(spec: ProjectSpec, registerScreen: boolean, classic: boolean): string {
  const rendererLines = fabricClientRendererLines(spec, classic)
  const imports = ['import net.fabricmc.api.ClientModInitializer;']
  if (registerScreen) {
    imports.push('import net.minecraft.client.gui.screen.ingame.HandledScreens;')
  }
  if (spec.mobs.length > 0) {
    imports.push('import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;')
    if (classic) {
      imports.push('import net.fabricmc.fabric.api.client.rendering.v1.EntityModelLayerRegistry;')
    } else {
      imports.push('import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;')
      imports.push('import net.minecraft.text.Text;')
    }
  }
  const layerLine = classic && spec.mobs.length > 0
    ? `    EntityModelLayerRegistry.registerModelLayer(CraftStudioMobModel.LAYER, CraftStudioMobModel::getTexturedModelData);`
    : ''
  const warning = !classic && spec.mobs.length > 0
    ? `    ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> client.execute(() -> {
      if (client.player != null) {
        client.player.sendMessage(Text.literal("[CraftStudio] Custom entities are registered but invisible on this Fabric pin until a render-state model exists."), false);
      }
    }));`
    : ''
  return `package ${spec.packageName};

${imports.join('\n')}

public class ${spec.mainClass}Client implements ClientModInitializer {
  @Override
  public void onInitializeClient() {
    ${registerScreen ? `HandledScreens.register(${spec.mainClass}.EXAMPLE_MENU, ExampleScreen::new);` : ''}
${layerLine}
${rendererLines}
${warning}
  }
}
`
}

export function fabricMenuField(spec: ProjectSpec, style: FabricItemRegistration): string {
  if (spec.modGuis.length === 0) {
    return ''
  }
  if (style === 'registry_key') {
    return `  public static final RegistryKey<ScreenHandlerType<?>> EXAMPLE_MENU_KEY = RegistryKey.of(
    RegistryKeys.SCREEN_HANDLER,
    Identifier.of(MOD_ID, "example_menu")
  );

  public static final ScreenHandlerType<ExampleScreenHandler> EXAMPLE_MENU = Registry.register(
    Registries.SCREEN_HANDLER,
    EXAMPLE_MENU_KEY,
    new ScreenHandlerType<>(ExampleScreenHandler::new, FeatureFlags.VANILLA_FEATURES)
  );`
  }
  return `  public static final ScreenHandlerType<ExampleScreenHandler> EXAMPLE_MENU = Registry.register(
    Registries.SCREEN_HANDLER,
    Identifier.of(MOD_ID, "example_menu"),
    new ScreenHandlerType<>(ExampleScreenHandler::new, FeatureFlags.VANILLA_FEATURES)
  );`
}

export function planFabricEntityRenderers(
  spec: ProjectSpec,
  packagePath: string,
  classic: boolean
): PlannedFile[] {
  if (spec.mobs.length === 0) {
    return []
  }
  const files: PlannedFile[] = []
  if (classic) {
    files.push({
      relativePath: `src/main/java/${packagePath}/CraftStudioMobModel.java`,
      encoding: 'utf8',
      contents: `package ${spec.packageName};

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
    })
  }
  for (const mob of spec.mobs) {
    const cls = entityClassName(mob.id)
    const renderer = `${cls}Renderer`
    if (classic) {
      files.push({
        relativePath: `src/main/java/${packagePath}/${renderer}.java`,
        encoding: 'utf8',
        contents: `package ${spec.packageName};

import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.util.Identifier;

public class ${renderer} extends MobEntityRenderer<${cls}, CraftStudioMobModel<${cls}>> {
  private static final Identifier TEXTURE = Identifier.of(${spec.mainClass}.MOD_ID, "textures/entity/preset_mob.png");

  public ${renderer}(EntityRendererFactory.Context context) {
    super(context, new CraftStudioMobModel<>(context.getPart(CraftStudioMobModel.LAYER)), 0.5f);
  }

  @Override
  public Identifier getTexture(${cls} entity) {
    return TEXTURE;
  }
}
`
      })
    } else {
      files.push({
        relativePath: `src/main/java/${packagePath}/${renderer}.java`,
        encoding: 'utf8',
        contents: `package ${spec.packageName};

import net.minecraft.client.render.entity.EntityRenderer;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.state.EntityRenderState;

/**
 * Compiling 1.21.2+ render-state stub. No model is drawn — entities stay invisible until a later model exists.
 */
public class ${renderer} extends EntityRenderer<${cls}, EntityRenderState> {
  public ${renderer}(EntityRendererFactory.Context context) {
    super(context);
  }

  @Override
  public EntityRenderState createRenderState() {
    return new EntityRenderState();
  }
}
`
      })
    }
  }
  return files
}

export function fabricClientRendererLines(spec: ProjectSpec, _classic: boolean): string {
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
