import type { ProjectSpec, SpecItem } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import { hasWeaponBehavior, type SpecWeapon } from '../../../shared/weaponSpec'
import { requirementMarkdown, forgeWeaponRequirementRows } from '../../../shared/requirementStatus'
import { javaEscape } from '../wrapper'
import type { PlannedFile } from '../types'

export function itemsWithWeaponBehavior(spec: ProjectSpec): SpecItem[] {
  return spec.items.filter((item) => hasWeaponBehavior(item.weapon))
}

export function needsForgeWeaponCode(spec: ProjectSpec): boolean {
  return itemsWithWeaponBehavior(spec).length > 0
}

export function weaponItemConstructor(item: SpecItem): string {
  const props = 'ITEM_PROPS_PLACEHOLDER'
  if (item.weapon?.smash) {
    return `new CraftStudioMaceItem(${props}, CraftStudioWeaponAbilities.${toConstName(item.id)})`
  }
  if (hasWeaponBehavior(item.weapon)) {
    return `new CraftStudioAbilityItem(${props}, CraftStudioWeaponAbilities.${toConstName(item.id)})`
  }
  return `new Item(${props})`
}

export function planForgeWeaponFiles(spec: ProjectSpec, packagePath: string): PlannedFile[] {
  const weapons = itemsWithWeaponBehavior(spec)
  if (weapons.length === 0) {
    return []
  }
  return [
    {
      relativePath: `src/main/java/${packagePath}/CraftStudioWeaponAbilities.java`,
      encoding: 'utf8',
      contents: abilitiesJava(spec, weapons)
    },
    {
      relativePath: `src/main/java/${packagePath}/WeaponAbilityEvents.java`,
      encoding: 'utf8',
      contents: eventsJava(spec)
    },
    {
      relativePath: `src/main/java/${packagePath}/CraftStudioMaceItem.java`,
      encoding: 'utf8',
      contents: maceItemJava(spec)
    },
    {
      relativePath: `src/main/java/${packagePath}/CraftStudioAbilityItem.java`,
      encoding: 'utf8',
      contents: abilityItemJava(spec)
    },
    {
      relativePath: 'WEAPON_REQUIREMENTS.md',
      encoding: 'utf8',
      contents: weaponRequirementsDoc(spec)
    }
  ]
}

function f(value: number): string {
  return Number.isInteger(value) ? `${value}.0f` : `${value}f`
}

function d(value: number): string {
  return Number.isInteger(value) ? `${value}.0d` : `${value}d`
}

function abilitiesJava(spec: ProjectSpec, weapons: SpecItem[]): string {
  const blocks = weapons.map((item) => abilityConst(item)).join('\n\n')
  return `package ${spec.packageName};

/**
 * Per-item weapon numbers copied from the CraftStudio spec.
 * Legendary Mace is one acceptance case; this class is generated for any smash/ability item.
 */
public final class CraftStudioWeaponAbilities {
  private CraftStudioWeaponAbilities() {}

  public record EnchantmentSpec(String id, int level) {}

  public record WeaponSpec(
    boolean smash,
    boolean lifeSteal,
    double lifeStealPercent,
    float lifeStealCap,
    boolean lifeStealHostileOnly,
    boolean shockwave,
    float minFallBlocks,
    int cooldownTicks,
    double shockwaveRadius,
    float shockwaveDamage,
    double upwardImpulse,
    boolean terrain,
    int terrainRadius,
    int terrainMaxBlocks,
    String[] terrainAllowBlocks,
    EnchantmentSpec[] enchantments
  ) {}

${blocks}
}
`
}

function abilityConst(item: SpecItem): string {
  const weapon = item.weapon!
  const life = weapon.lifeSteal
  const wave = weapon.shockwave
  const terrain = weapon.terrain
  const enchants = weapon.enchantments
    .map((entry) => `        new EnchantmentSpec("${javaEscape(entry.id)}", ${entry.level})`)
    .join(',\n')
  const allow = (terrain?.allowBlocks ?? [])
    .map((id) => `"${javaEscape(id)}"`)
    .join(', ')
  return `  public static final WeaponSpec ${toConstName(item.id)} = new WeaponSpec(
    ${weapon.smash},
    ${life?.enabled === true},
    ${d(life?.percent ?? 0.2)},
    ${f(life?.capHealth ?? 4)},
    ${life?.hostileOnly !== false},
    ${wave?.enabled === true},
    ${f(wave?.minFallBlocks ?? 3)},
    ${Math.round((wave?.cooldownSeconds ?? 10) * 20)},
    ${d(wave?.radius ?? 6)},
    ${f(wave?.damage ?? 8)},
    ${d(wave?.upwardImpulse ?? 1)},
    ${terrain?.enabled === true},
    ${terrain?.radius ?? 3},
    ${terrain?.maxBlocks ?? 24},
    new String[] { ${allow} },
    new EnchantmentSpec[] {
${enchants || '        '}
    }
  );`
}

function eventsJava(spec: ProjectSpec): string {
  return `package ${spec.packageName};

import java.util.HashSet;
import java.util.Set;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.monster.Enemy;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import net.minecraftforge.event.entity.living.LivingDamageEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;

/**
 * Server-authoritative weapon extras for Forge 1.21.1 (official mappings).
 * Life Steal reads LivingDamageEvent.getAmount() (post-armor health damage).
 * Shockwave damage is tagged so it cannot recurse or trigger Life Steal.
 */
@Mod.EventBusSubscriber(modid = ${spec.mainClass}.MOD_ID, bus = Mod.EventBusSubscriber.Bus.FORGE)
public final class WeaponAbilityEvents {
  private static final ThreadLocal<Boolean> SHOCKWAVE_ACTIVE = ThreadLocal.withInitial(() -> Boolean.FALSE);

  private WeaponAbilityEvents() {}

  public static boolean isShockwaveActive() {
    return Boolean.TRUE.equals(SHOCKWAVE_ACTIVE.get());
  }

  @SubscribeEvent
  public static void onLivingDamage(LivingDamageEvent event) {
    if (event.getEntity().level().isClientSide()) {
      return;
    }
    if (isShockwaveActive()) {
      return;
    }
    DamageSource source = event.getSource();
    if (!(source.getEntity() instanceof Player player)) {
      return;
    }
    ItemStack stack = player.getMainHandItem();
    CraftStudioWeaponAbilities.WeaponSpec spec = specOf(stack);
    if (spec == null || !spec.lifeSteal()) {
      return;
    }
    LivingEntity target = event.getEntity();
    if (!isEligibleHostile(target, spec)) {
      return;
    }
    float actual = event.getAmount();
    if (actual <= 0.0f) {
      return;
    }
    float heal = Math.min(spec.lifeStealCap(), actual * (float) spec.lifeStealPercent());
    float max = player.getMaxHealth();
    player.setHealth(Math.min(max, player.getHealth() + heal));
  }

  @SubscribeEvent
  public static void onItemCrafted(PlayerEvent.ItemCraftedEvent event) {
    ItemStack stack = event.getCrafting();
    CraftStudioWeaponAbilities.WeaponSpec spec = specOf(stack);
    if (spec == null || spec.enchantments().length == 0) {
      return;
    }
    applyEnchantments(event.getEntity().level().registryAccess(), stack, spec);
  }

  public static void onDirectHit(Player player, LivingEntity target, ItemStack stack, CraftStudioWeaponAbilities.WeaponSpec spec) {
    if (player.level().isClientSide() || spec == null) {
      return;
    }
    if (isShockwaveActive()) {
      return;
    }
    if (spec.shockwave() && player.fallDistance >= spec.minFallBlocks()) {
      tryShockwave(player, target, spec);
    }
  }

  public static void tryShockwave(Player player, LivingEntity directTarget, CraftStudioWeaponAbilities.WeaponSpec spec) {
    if (!(player.level() instanceof ServerLevel level)) {
      return;
    }
    Item item = player.getMainHandItem().getItem();
    if (player.getCooldowns().isOnCooldown(item)) {
      if (player instanceof net.minecraft.server.level.ServerPlayer serverPlayer) {
        serverPlayer.displayClientMessage(Component.literal("Shockwave cooling down"), true);
      }
      return;
    }
    player.getCooldowns().addCooldown(item, spec.cooldownTicks());
    AABB box = directTarget.getBoundingBox().inflate(spec.shockwaveRadius());
    SHOCKWAVE_ACTIVE.set(Boolean.TRUE);
    try {
      for (LivingEntity other : level.getEntitiesOfClass(LivingEntity.class, box)) {
        if (other == player || other == directTarget) {
          continue;
        }
        if (!isEligibleHostile(other, spec)) {
          continue;
        }
        if (other.distanceToSqr(directTarget) > spec.shockwaveRadius() * spec.shockwaveRadius()) {
          continue;
        }
        other.hurt(player.damageSources().playerAttack(player), spec.shockwaveDamage());
        Vec3 motion = other.getDeltaMovement();
        other.setDeltaMovement(motion.x, spec.upwardImpulse(), motion.z);
        other.hurtMarked = true;
      }
      level.sendParticles(ParticleTypes.CRIT, directTarget.getX(), directTarget.getY(), directTarget.getZ(), 28, 0.7, 0.2, 0.7, 0.12);
      level.sendParticles(ParticleTypes.EXPLOSION, directTarget.getX(), directTarget.getY(), directTarget.getZ(), 1, 0.0, 0.0, 0.0, 0.0);
      level.playSound(null, directTarget.blockPosition(), SoundEvents.MACE_SMASH_GROUND, SoundSource.PLAYERS, 1.0f, 1.0f);
      if (spec.terrain() && CraftStudioConfig.enableTerrainDestruction) {
        breakSurface(level, BlockPos.containing(directTarget.position()), spec);
      }
    } finally {
      SHOCKWAVE_ACTIVE.set(Boolean.FALSE);
    }
  }

  private static void breakSurface(ServerLevel level, BlockPos origin, CraftStudioWeaponAbilities.WeaponSpec spec) {
    int broken = 0;
    int radius = spec.terrainRadius();
    Set<Long> columns = new HashSet<>();
    for (int dx = -radius; dx <= radius && broken < spec.terrainMaxBlocks(); dx++) {
      for (int dz = -radius; dz <= radius && broken < spec.terrainMaxBlocks(); dz++) {
        if (dx * dx + dz * dz > radius * radius) {
          continue;
        }
        long column = (((long) (origin.getX() + dx)) << 32) ^ (origin.getZ() + dz);
        if (!columns.add(column)) {
          continue;
        }
        for (int y = origin.getY() + 1; y >= origin.getY() - 4; y--) {
          BlockPos pos = new BlockPos(origin.getX() + dx, y, origin.getZ() + dz);
          BlockState state = level.getBlockState(pos);
          if (state.isAir()) {
            continue;
          }
          if (canDestroy(level, pos, state, spec)) {
            level.removeBlock(pos, false);
            broken += 1;
          }
          break;
        }
      }
    }
  }

  private static boolean canDestroy(ServerLevel level, BlockPos pos, BlockState state, CraftStudioWeaponAbilities.WeaponSpec spec) {
    if (state.hasBlockEntity() || level.getBlockEntity(pos) instanceof BlockEntity) {
      return false;
    }
    if (!state.getFluidState().isEmpty()) {
      return false;
    }
    ResourceLocation key = net.minecraftforge.registries.ForgeRegistries.BLOCKS.getKey(state.getBlock());
    if (key == null) {
      return false;
    }
    String id = key.toString();
    for (String allow : spec.terrainAllowBlocks()) {
      if (allow.equals(id)) {
        return true;
      }
    }
    return false;
  }

  private static boolean isEligibleHostile(LivingEntity entity, CraftStudioWeaponAbilities.WeaponSpec spec) {
    if (entity instanceof Player) {
      return false;
    }
    if (spec.lifeStealHostileOnly() || spec.shockwave()) {
      return entity instanceof Enemy;
    }
    return true;
  }

  static CraftStudioWeaponAbilities.WeaponSpec specOf(ItemStack stack) {
    Item item = stack.getItem();
    if (item instanceof CraftStudioMaceItem mace) {
      return mace.abilities();
    }
    if (item instanceof CraftStudioAbilityItem ability) {
      return ability.abilities();
    }
    return null;
  }

  static void applyEnchantments(net.minecraft.core.HolderLookup.Provider access, ItemStack stack, CraftStudioWeaponAbilities.WeaponSpec spec) {
    var lookup = access.lookupOrThrow(Registries.ENCHANTMENT);
    for (CraftStudioWeaponAbilities.EnchantmentSpec entry : spec.enchantments()) {
      ResourceLocation id = ResourceLocation.parse(entry.id());
      var holder = lookup.get(ResourceKey.create(Registries.ENCHANTMENT, id));
      holder.ifPresent(value -> stack.enchant(value, entry.level()));
    }
  }
}
`
}

function maceItemJava(spec: ProjectSpec): string {
  return `package ${spec.packageName};

import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.MaceItem;

/**
 * Reusable Forge 1.21.1 mace item. Vanilla smash comes from {@link MaceItem#hurtEnemy}.
 * Extra shockwave / life-steal hooks stay server-side in {@link WeaponAbilityEvents}.
 */
public class CraftStudioMaceItem extends MaceItem {
  private final CraftStudioWeaponAbilities.WeaponSpec abilities;

  public CraftStudioMaceItem(Properties properties, CraftStudioWeaponAbilities.WeaponSpec abilities) {
    super(properties);
    this.abilities = abilities;
  }

  public CraftStudioWeaponAbilities.WeaponSpec abilities() {
    return this.abilities;
  }

  @Override
  public boolean hurtEnemy(ItemStack stack, LivingEntity target, LivingEntity attacker) {
    boolean smash = super.hurtEnemy(stack, target, attacker);
    if (!attacker.level().isClientSide() && attacker instanceof Player player) {
      WeaponAbilityEvents.onDirectHit(player, target, stack, this.abilities);
    }
    return smash;
  }
}
`
}

function abilityItemJava(spec: ProjectSpec): string {
  return `package ${spec.packageName};

import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

public class CraftStudioAbilityItem extends Item {
  private final CraftStudioWeaponAbilities.WeaponSpec abilities;

  public CraftStudioAbilityItem(Properties properties, CraftStudioWeaponAbilities.WeaponSpec abilities) {
    super(properties);
    this.abilities = abilities;
  }

  public CraftStudioWeaponAbilities.WeaponSpec abilities() {
    return this.abilities;
  }

  @Override
  public boolean hurtEnemy(ItemStack stack, LivingEntity target, LivingEntity attacker) {
    boolean hit = super.hurtEnemy(stack, target, attacker);
    if (!attacker.level().isClientSide() && attacker instanceof Player player) {
      WeaponAbilityEvents.onDirectHit(player, target, stack, this.abilities);
    }
    return hit;
  }
}
`
}

export function weaponRequirementsDoc(spec: ProjectSpec): string {
  const weapons = itemsWithWeaponBehavior(spec)
  const first = weapons[0]?.weapon
  return requirementMarkdown(
    forgeWeaponRequirementRows({
      platform: 'forge',
      minecraftVersion: '1.21.1',
      hasSmash: weapons.some((item) => item.weapon?.smash),
      hasLifeSteal: weapons.some((item) => item.weapon?.lifeSteal?.enabled),
      hasShockwave: weapons.some((item) => item.weapon?.shockwave?.enabled),
      hasTerrain: weapons.some((item) => item.weapon?.terrain?.enabled),
      hasEnchantments: weapons.some((item) => (item.weapon?.enchantments.length ?? 0) > 0),
      hasTexture: weapons.some((item) => item.weapon && item.weapon.textureStyle !== 'none'),
      recipeExact: spec.recipes.length > 0,
      unsolicitedMob: false,
      unsolicitedLoot: spec.config.enableChestLoot,
      promptPreserved: spec.prompt.length > 0
    })
  ) + extraNotes(first)
}

function extraNotes(weapon: SpecWeapon | undefined): string {
  if (!weapon) {
    return ''
  }
  return [
    '',
    '## Generator invariants',
    '',
    '- Shockwave Life Steal is disabled (ThreadLocal `SHOCKWAVE_ACTIVE`).',
    '- Recursive shockwave activation is disabled by the same flag.',
    '- Particles, smash sound, and action-bar cooldown feedback are always emitted when a shockwave fires.',
    '- Terrain never drops blocks, never edits fluids or block entities, and breaks at most one surface block per column.',
    '- `CraftStudioConfig.enableTerrainDestruction=false` keeps the shockwave and disables block edits only.',
    ''
  ].join('\n')
}

export function enchantmentResultComponents(item: SpecItem): Record<string, unknown> | undefined {
  const list = item.weapon?.enchantments ?? []
  if (list.length === 0) {
    return undefined
  }
  const levels: Record<string, number> = {}
  for (const entry of list) {
    levels[entry.id] = entry.level
  }
  return {
    'minecraft:enchantments': {
      levels
    }
  }
}
