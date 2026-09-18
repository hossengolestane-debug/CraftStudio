import { goalsAreHostile, resolveMobGoals, type MobGoal } from '../../../shared/goals'
import type { SpecMob } from '../../../shared/spec'

export function isHostilePreset(preset: SpecMob['preset']): boolean {
  return preset === 'hostile_melee' || preset === 'leap_melee'
}

export function isHostileMob(mob: SpecMob): boolean {
  return isHostilePreset(mob.preset) || goalsAreHostile(resolveMobGoals(mob))
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

function yarnGoalLine(goal: MobGoal, priority: number): string {
  switch (goal) {
    case 'melee':
      return `    this.goalSelector.add(${priority}, new MeleeAttackGoal(this, 1.1, true));`
    case 'leap':
      return `    this.goalSelector.add(${priority}, new PounceAtTargetGoal(this, 0.4f));`
    case 'follow_look':
      return `    this.goalSelector.add(${priority}, new LookAtEntityGoal(this, PlayerEntity.class, 16.0f));`
    case 'look_player':
      return `    this.goalSelector.add(${priority}, new LookAtEntityGoal(this, PlayerEntity.class, 12.0f));`
    case 'avoid_player':
      return `    this.goalSelector.add(${priority}, new FleeEntityGoal<>(this, PlayerEntity.class, 8.0f, 1.0, 1.2));`
    case 'flee':
      return `    this.goalSelector.add(${priority}, new FleeEntityGoal<>(this, PlayerEntity.class, 6.0f, 1.0, 1.3));`
    case 'wander':
    default:
      return `    this.goalSelector.add(${priority}, new WanderAroundFarGoal(this, 1.0));`
  }
}

function mojangGoalLine(goal: MobGoal, priority: number): string {
  switch (goal) {
    case 'melee':
      return `    this.goalSelector.addGoal(${priority}, new MeleeAttackGoal(this, 1.1d, true));`
    case 'leap':
      return `    this.goalSelector.addGoal(${priority}, new LeapAtTargetGoal(this, 0.4f));`
    case 'follow_look':
      return `    this.goalSelector.addGoal(${priority}, new LookAtPlayerGoal(this, Player.class, 16.0f));`
    case 'look_player':
      return `    this.goalSelector.addGoal(${priority}, new LookAtPlayerGoal(this, Player.class, 12.0f));`
    case 'avoid_player':
      return `    this.goalSelector.addGoal(${priority}, new AvoidEntityGoal<>(this, Player.class, 8.0f, 1.0d, 1.2d));`
    case 'flee':
      return `    this.goalSelector.addGoal(${priority}, new PanicGoal(this, 1.4d));`
    case 'wander':
    default:
      return `    this.goalSelector.addGoal(${priority}, new WaterAvoidingRandomStrollGoal(this, 1.0d));`
  }
}

export function yarnGoalBlock(mob: SpecMob): string {
  const goals = resolveMobGoals(mob)
  const targeting =
    mob.targeting === 'players'
      ? '    this.targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));\n'
      : mob.targeting === 'hostiles'
        ? '    this.targetSelector.add(2, new ActiveTargetGoal<>(this, HostileEntity.class, true));\n'
        : ''
  const lines = goals.map((goal, index) => yarnGoalLine(goal, index + 1))
  const hostile = goalsAreHostile(goals)
  if (hostile) {
    lines.push('    this.targetSelector.add(1, new RevengeGoal(this));')
  }
  const targetLine = targeting || (hostile ? '    this.targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));\n' : '')
  return `${lines.join('\n')}\n${targetLine}`
}

export function mojangGoalBlock(mob: SpecMob): string {
  const goals = resolveMobGoals(mob)
  const targeting =
    mob.targeting === 'players'
      ? '    this.targetSelector.addGoal(2, new NearestAttackableTargetGoal<>(this, Player.class, true));\n'
      : mob.targeting === 'hostiles'
        ? '    this.targetSelector.addGoal(2, new NearestAttackableTargetGoal<>(this, Monster.class, true));\n'
        : ''
  const lines = goals.map((goal, index) => mojangGoalLine(goal, index + 1))
  const hostile = goalsAreHostile(goals)
  const targetLine = targeting || (hostile ? '    this.targetSelector.addGoal(1, new NearestAttackableTargetGoal<>(this, Player.class, true));\n' : '')
  return `${lines.join('\n')}\n${targetLine}`
}
