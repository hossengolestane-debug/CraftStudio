import type { SpecMob } from '../../../shared/spec'

export function isHostilePreset(preset: SpecMob['preset']): boolean {
  return preset === 'hostile_melee' || preset === 'leap_melee'
}

export function yarnParent(mob: SpecMob): { extend: string; importName: string } {
  if (mob.preset === 'hostile_melee') {
    return { extend: 'HostileEntity', importName: 'net.minecraft.entity.mob.HostileEntity' }
  }
  if (mob.preset === 'passive_wanderer') {
    return { extend: 'PassiveEntity', importName: 'net.minecraft.entity.passive.PassiveEntity' }
  }
  return { extend: 'PathAwareEntity', importName: 'net.minecraft.entity.mob.PathAwareEntity' }
}

export function mojangParent(mob: SpecMob): { extend: string; importName: string } {
  if (mob.preset === 'hostile_melee') {
    return { extend: 'Monster', importName: 'net.minecraft.world.entity.monster.Monster' }
  }
  if (mob.preset === 'passive_wanderer') {
    return { extend: 'Animal', importName: 'net.minecraft.world.entity.animal.Animal' }
  }
  return { extend: 'PathfinderMob', importName: 'net.minecraft.world.entity.PathfinderMob' }
}

export function yarnGoalBlock(mob: SpecMob): string {
  const targeting =
    mob.targeting === 'players'
      ? '    this.targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));\n'
      : mob.targeting === 'hostiles'
        ? '    this.targetSelector.add(2, new ActiveTargetGoal<>(this, HostileEntity.class, true));\n'
        : ''
  if (mob.preset === 'hostile_melee') {
    return `    this.goalSelector.add(1, new MeleeAttackGoal(this, 1.1, true));
    this.targetSelector.add(1, new RevengeGoal(this));
${targeting || '    this.targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));\n'}`
  }
  if (mob.preset === 'leap_melee') {
    return `    this.goalSelector.add(1, new PounceAtTargetGoal(this, 0.4f));
    this.goalSelector.add(2, new MeleeAttackGoal(this, 1.1, true));
    this.targetSelector.add(1, new RevengeGoal(this));
${targeting || '    this.targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));\n'}`
  }
  if (mob.preset === 'follow_player') {
    return `    this.goalSelector.add(1, new LookAtEntityGoal(this, PlayerEntity.class, 16.0f));
    this.goalSelector.add(2, new WanderAroundFarGoal(this, 1.2));
${targeting}`
  }
  if (mob.preset === 'avoid_players') {
    return `    this.goalSelector.add(1, new FleeEntityGoal<>(this, PlayerEntity.class, 8.0f, 1.0, 1.2));
    this.goalSelector.add(2, new WanderAroundFarGoal(this, 1.0));
${targeting}`
  }
  if (mob.preset === 'stationary_lookout') {
    return `    this.goalSelector.add(1, new LookAtEntityGoal(this, PlayerEntity.class, 12.0f));
${targeting}`
  }
  if (mob.preset === 'neutral_flee') {
    return `    this.goalSelector.add(1, new FleeEntityGoal<>(this, PlayerEntity.class, 6.0f, 1.0, 1.3));
    this.goalSelector.add(2, new WanderAroundFarGoal(this, 1.0));
${targeting}`
  }
  return `    this.goalSelector.add(1, new WanderAroundFarGoal(this, 1.0));
${targeting}`
}

export function mojangGoalBlock(mob: SpecMob): string {
  const targeting =
    mob.targeting === 'players'
      ? '    this.targetSelector.addGoal(2, new NearestAttackableTargetGoal<>(this, Player.class, true));\n'
      : mob.targeting === 'hostiles'
        ? '    this.targetSelector.addGoal(2, new NearestAttackableTargetGoal<>(this, Monster.class, true));\n'
        : ''
  if (mob.preset === 'hostile_melee') {
    return `    this.goalSelector.addGoal(1, new MeleeAttackGoal(this, 1.1d, true));
${targeting || '    this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));\n'}`
  }
  if (mob.preset === 'leap_melee') {
    return `    this.goalSelector.addGoal(1, new LeapAtTargetGoal(this, 0.4f));
    this.goalSelector.addGoal(2, new MeleeAttackGoal(this, 1.1d, true));
${targeting || '    this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));\n'}`
  }
  if (mob.preset === 'follow_player') {
    return `    this.goalSelector.addGoal(1, new LookAtPlayerGoal(this, Player.class, 16.0f));
    this.goalSelector.addGoal(2, new WaterAvoidingRandomStrollGoal(this, 1.2d));
${targeting}`
  }
  if (mob.preset === 'avoid_players') {
    return `    this.goalSelector.addGoal(1, new AvoidEntityGoal<>(this, Player.class, 8.0f, 1.0d, 1.2d));
    this.goalSelector.addGoal(2, new WaterAvoidingRandomStrollGoal(this, 1.0d));
${targeting}`
  }
  if (mob.preset === 'stationary_lookout') {
    return `    this.goalSelector.addGoal(1, new LookAtPlayerGoal(this, Player.class, 12.0f));
${targeting}`
  }
  if (mob.preset === 'neutral_flee') {
    return `    this.goalSelector.addGoal(1, new PanicGoal(this, 1.4d));
    this.goalSelector.addGoal(2, new WaterAvoidingRandomStrollGoal(this, 1.0d));
${targeting}`
  }
  return `    this.goalSelector.addGoal(1, new WaterAvoidingRandomStrollGoal(this, 1.0d));
${targeting}`
}
