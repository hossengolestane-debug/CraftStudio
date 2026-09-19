export const INJECTED_CHEST_TABLES = [
  'minecraft:chests/simple_dungeon',
  'minecraft:chests/abandoned_mineshaft',
  'minecraft:chests/spawn_bonus_chest',
  'minecraft:chests/village/village_toolsmith'
] as const

export type InjectedChestTable = (typeof INJECTED_CHEST_TABLES)[number]

export function injectedChestPath(table: InjectedChestTable): string {
  return table.replace(/^minecraft:/, '')
}

export function injectedChestFileStem(table: InjectedChestTable): string {
  return table.replace('minecraft:chests/', '').replace(/[/:]/g, '_')
}
