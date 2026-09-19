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

export const MOB_TARGETING = ['none', 'players', 'hostiles', 'both'] as const
export type MobTargeting = (typeof MOB_TARGETING)[number]

export interface ResolvedMobGoal {
  id: MobGoal
  priority: number
}

export const PRESET_GOAL_LISTS = {
  passive_wanderer: [{ id: 'wander', priority: 4 }] as const,
  hostile_melee: [{ id: 'melee', priority: 2 }] as const,
  neutral_flee: [
    { id: 'flee', priority: 1 },
    { id: 'wander', priority: 4 }
  ] as const,
  avoid_players: [
    { id: 'avoid_player', priority: 1 },
    { id: 'wander', priority: 4 }
  ] as const,
  stationary_lookout: [{ id: 'look_player', priority: 3 }] as const,
  follow_player: [
    { id: 'follow_look', priority: 2 },
    { id: 'wander', priority: 4 }
  ] as const,
  leap_melee: [
    { id: 'leap', priority: 1 },
    { id: 'melee', priority: 2 }
  ] as const
} as const

export function normalizeGoalEntry(entry: MobGoal | ResolvedMobGoal, index: number): ResolvedMobGoal {
  if (typeof entry === 'string') {
    return { id: entry, priority: index + 1 }
  }
  return { id: entry.id, priority: Math.min(9, Math.max(0, entry.priority)) }
}

export function resolveMobGoals(mob: {
  preset: string
  goals: readonly (MobGoal | ResolvedMobGoal)[]
}): ResolvedMobGoal[] {
  if (mob.goals.length > 0) {
    return mob.goals.map((entry, index) => normalizeGoalEntry(entry, index)).slice(0, MOB_GOAL_CAP)
  }
  const expanded = PRESET_GOAL_LISTS[mob.preset as keyof typeof PRESET_GOAL_LISTS]
  return expanded ? expanded.map((entry) => ({ id: entry.id, priority: entry.priority })) : [{ id: 'wander', priority: 4 }]
}

export function goalId(entry: MobGoal | ResolvedMobGoal): MobGoal {
  return typeof entry === 'string' ? entry : entry.id
}

export function goalsAreHostile(goals: readonly (MobGoal | ResolvedMobGoal)[]): boolean {
  return goals.some((entry) => {
    const id = goalId(entry)
    return id === 'melee' || id === 'leap'
  })
}
