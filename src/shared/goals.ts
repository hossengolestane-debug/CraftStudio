export const MOB_GOALS = [
  'wander',
  'look_player',
  'melee',
  'flee',
  'avoid_player',
  'leap',
  'follow_look'
] as const
export type MobGoal = (typeof MOB_GOALS)[number]

export const MOB_GOAL_CAP = 5

export const PRESET_GOAL_LISTS = {
  passive_wanderer: ['wander'],
  hostile_melee: ['melee'],
  neutral_flee: ['flee', 'wander'],
  avoid_players: ['avoid_player', 'wander'],
  stationary_lookout: ['look_player'],
  follow_player: ['follow_look', 'wander'],
  leap_melee: ['leap', 'melee']
} as const

export function resolveMobGoals(mob: { preset: string; goals: readonly MobGoal[] }): MobGoal[] {
  if (mob.goals.length > 0) {
    return [...mob.goals].slice(0, MOB_GOAL_CAP)
  }
  const expanded = PRESET_GOAL_LISTS[mob.preset as keyof typeof PRESET_GOAL_LISTS]
  return expanded ? [...expanded] : ['wander']
}

export function goalsAreHostile(goals: readonly MobGoal[]): boolean {
  return goals.includes('melee') || goals.includes('leap')
}
