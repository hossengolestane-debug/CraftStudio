import type { ProjectSpec } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import { entityClassName } from '../naming'
import type { PlannedFile } from '../types'

export type ForgeLikeClientStyle = 'classic' | 'render_state' | 'render_state_rooted'

export function forgeLikeClientStyle(flavor: 'forge' | 'neoforge', minecraftVersion: string): ForgeLikeClientStyle {
  if (flavor === 'forge' || minecraftVersion === '1.21.1') {
    return 'classic'
  }
  return 'render_state_rooted'
}

function classicModelJava(spec: ProjectSpec): string {
  return `package ${spec.packageName};

import net.minecraft.client.model.HierarchicalModel;
import net.minecraft.client.model.geom.ModelLayerLocation;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.LivingEntity;

/**
 * Dedicated cube model. Vanilla model classes are typed to vanilla entities and are not used.
 */
public class CraftStudioMobModel<T extends LivingEntity> extends HierarchicalModel<T> {
  public static final ModelLayerLocation LAYER = new ModelLayerLocation(
    ResourceLocation.fromNamespaceAndPath(${spec.mainClass}.MOD_ID, "preset_mob"), "main");
  private final ModelPart root;

  public CraftStudioMobModel(ModelPart root) {
    this.root = root;
  }

  public static LayerDefinition createBodyLayer() {
    MeshDefinition mesh = new MeshDefinition();
    PartDefinition root = mesh.getRoot();
    root.addOrReplaceChild("body", CubeListBuilder.create().texOffs(0, 0).addBox(-3.0F, 10.0F, -2.0F, 6.0F, 8.0F, 4.0F), PartPose.ZERO);
    root.addOrReplaceChild("head", CubeListBuilder.create().texOffs(16, 0).addBox(-3.0F, 4.0F, -3.0F, 6.0F, 6.0F, 6.0F), PartPose.ZERO);
    return LayerDefinition.create(mesh, 64, 32);
  }

  @Override
  public ModelPart root() {
    return this.root;
  }

  @Override
  public void setupAnim(T entity, float limbSwing, float limbSwingAmount, float ageInTicks, float netHeadYaw, float headPitch) {
  }
}
`
}

function renderStateModelJava(spec: ProjectSpec, rooted: boolean): string {
  const ctor = rooted
    ? `  public CraftStudioMobModel(ModelPart root) {
    super(root);
    this.root = root;
  }`
    : `  public CraftStudioMobModel(ModelPart root) {
    this.root = root;
  }`
  return `package ${spec.packageName};

import net.minecraft.client.model.EntityModel;
import net.minecraft.client.model.geom.ModelLayerLocation;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import net.minecraft.resources.ResourceLocation;

/**
 * Visible render-state cube model. Vanilla model classes are typed to vanilla entities and are not used.
 */
public class CraftStudioMobModel extends EntityModel<LivingEntityRenderState> {
  public static final ModelLayerLocation LAYER = new ModelLayerLocation(
    ResourceLocation.fromNamespaceAndPath(${spec.mainClass}.MOD_ID, "preset_mob"), "main");
  private final ModelPart root;

${ctor}

  public static LayerDefinition createBodyLayer() {
    MeshDefinition mesh = new MeshDefinition();
    PartDefinition root = mesh.getRoot();
    root.addOrReplaceChild("body", CubeListBuilder.create().texOffs(0, 0).addBox(-3.0F, 10.0F, -2.0F, 6.0F, 8.0F, 4.0F), PartPose.ZERO);
    root.addOrReplaceChild("head", CubeListBuilder.create().texOffs(16, 0).addBox(-3.0F, 4.0F, -3.0F, 6.0F, 6.0F, 6.0F), PartPose.ZERO);
    return LayerDefinition.create(mesh, 64, 32);
  }

  @Override
  public void setupAnim(LivingEntityRenderState state) {
  }
}
`
}

function classicRendererJava(spec: ProjectSpec, mobId: string): string {
  const cls = entityClassName(mobId)
  return `package ${spec.packageName};

import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.MobRenderer;
import net.minecraft.resources.ResourceLocation;

public class ${cls}Renderer extends MobRenderer<${cls}, CraftStudioMobModel<${cls}>> {
  private static final ResourceLocation TEXTURE = ResourceLocation.fromNamespaceAndPath(${spec.mainClass}.MOD_ID, "textures/entity/preset_mob.png");

  public ${cls}Renderer(EntityRendererProvider.Context context) {
    super(context, new CraftStudioMobModel<>(context.bakeLayer(CraftStudioMobModel.LAYER)), 0.5f);
  }

  @Override
  public ResourceLocation getTextureLocation(${cls} entity) {
    return TEXTURE;
  }
}
`
}

function renderStateRendererJava(spec: ProjectSpec, mobId: string): string {
  const cls = entityClassName(mobId)
  return `package ${spec.packageName};

import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import net.minecraft.resources.ResourceLocation;

/**
 * Visible LivingEntityRenderer + cube model. This is not a Minecraft-verified custom model.
 */
public class ${cls}Renderer extends LivingEntityRenderer<${cls}, LivingEntityRenderState, CraftStudioMobModel> {
  private static final ResourceLocation TEXTURE = ResourceLocation.fromNamespaceAndPath(${spec.mainClass}.MOD_ID, "textures/entity/preset_mob.png");

  public ${cls}Renderer(EntityRendererProvider.Context context) {
    super(context, new CraftStudioMobModel(context.bakeLayer(CraftStudioMobModel.LAYER)), 0.5f);
  }

  @Override
  public LivingEntityRenderState createRenderState() {
    return new LivingEntityRenderState();
  }

  @Override
  public ResourceLocation getTextureLocation(LivingEntityRenderState state) {
    return TEXTURE;
  }
}
`
}

function clientEntitiesJava(
  spec: ProjectSpec,
  flavor: 'forge' | 'neoforge',
  omitBus: boolean
): string {
  const rendererRegs = spec.mobs
    .map(
      (mob) =>
        `    event.registerEntityRenderer(${spec.mainClass}.${toConstName(mob.id)}.get(), ${entityClassName(mob.id)}Renderer::new);`
    )
    .join('\n')
  if (flavor === 'neoforge') {
    return `package ${spec.packageName};

import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;

@EventBusSubscriber(modid = ${spec.mainClass}.MOD_ID${omitBus ? '' : ', bus = EventBusSubscriber.Bus.MOD'}, value = Dist.CLIENT)
public final class ClientEntities {
  private ClientEntities() {}

  @SubscribeEvent
  public static void registerLayers(EntityRenderersEvent.RegisterLayerDefinitions event) {
    event.registerLayerDefinition(CraftStudioMobModel.LAYER, CraftStudioMobModel::createBodyLayer);
  }

  @SubscribeEvent
  public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
${rendererRegs}
  }
}
`
  }
  return `package ${spec.packageName};

import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.EntityRenderersEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

@Mod.EventBusSubscriber(modid = ${spec.mainClass}.MOD_ID, bus = Mod.EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
public final class ClientEntities {
  private ClientEntities() {}

  @SubscribeEvent
  public static void registerLayers(EntityRenderersEvent.RegisterLayerDefinitions event) {
    event.registerLayerDefinition(CraftStudioMobModel.LAYER, CraftStudioMobModel::createBodyLayer);
  }

  @SubscribeEvent
  public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
${rendererRegs}
  }
}
`
}

export function planForgeLikeEntityClientFiles(
  spec: ProjectSpec,
  packagePath: string,
  flavor: 'forge' | 'neoforge',
  style: ForgeLikeClientStyle,
  options: { omitEventBusSubscriberBus?: boolean } = {}
): PlannedFile[] {
  if (spec.mobs.length === 0) {
    return []
  }
  const files: PlannedFile[] = [
    {
      relativePath: `src/main/java/${packagePath}/CraftStudioMobModel.java`,
      encoding: 'utf8',
      contents: style === 'classic' ? classicModelJava(spec) : renderStateModelJava(spec, style === 'render_state_rooted')
    },
    {
      relativePath: `src/main/java/${packagePath}/ClientEntities.java`,
      encoding: 'utf8',
      contents: clientEntitiesJava(spec, flavor, Boolean(options.omitEventBusSubscriberBus))
    }
  ]
  for (const mob of spec.mobs) {
    files.push({
      relativePath: `src/main/java/${packagePath}/${entityClassName(mob.id)}Renderer.java`,
      encoding: 'utf8',
      contents: style === 'classic' ? classicRendererJava(spec, mob.id) : renderStateRendererJava(spec, mob.id)
    })
  }
  return files
}

export function forgeLikeEntityRenderingNote(flavor: 'forge' | 'neoforge', minecraftVersion: string, style: ForgeLikeClientStyle): string {
  const visible =
    style === 'classic'
      ? `${flavor === 'forge' ? 'Forge' : 'NeoForge'} ${minecraftVersion}: a compiling HierarchicalModel cube + MobRenderer is registered.`
      : `${flavor === 'forge' ? 'Forge' : 'NeoForge'} ${minecraftVersion}: a compiling LivingEntityRenderer + cube model is registered (render-state API).`
  return [
    '# Entity rendering note',
    '',
    visible,
    flavor === 'neoforge' ? 'This is NeoForge, not Forge.' : 'This is Forge, not NeoForge.',
    'This is not a Minecraft-verified custom model. Summon always works. Biome spawn tables emit only when enabled on the spec.',
    ''
  ].join('\n')
}
