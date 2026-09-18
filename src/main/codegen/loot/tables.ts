import type { ProjectSpec, SpecMob } from '../../../shared/spec'
import { vanillaItemConstant } from '../../../shared/itemStats'
import { toConstName } from '../../../shared/spec'
import type { PlannedFile } from '../types'

function itemName(spec: ProjectSpec, itemId: string): string {
  if (itemId.startsWith('minecraft:')) {
    return itemId
  }
  return `${spec.modId}:${itemId}`
}

function entityLootJson(spec: ProjectSpec, mob: SpecMob): string {
  const entries = mob.drops.map((drop) => {
    const entry: Record<string, unknown> = {
      type: 'minecraft:item',
      name: itemName(spec, drop.itemId),
      functions: [
        {
          function: 'minecraft:set_count',
          count: {
            type: 'minecraft:uniform',
            min: drop.min,
            max: drop.max
          }
        }
      ]
    }
    if (drop.chance < 1) {
      entry.conditions = [{ condition: 'minecraft:random_chance', chance: drop.chance }]
    }
    return entry
  })
  return `${JSON.stringify(
    {
      type: 'minecraft:entity',
      pools: [
        {
          rolls: 1.0,
          entries: entries.length
            ? entries
            : [
                {
                  type: 'minecraft:empty'
                }
              ]
        }
      ]
    },
    null,
    2
  )}\n`
}

export function planEntityLootFiles(spec: ProjectSpec): PlannedFile[] {
  return spec.mobs
    .filter((mob) => mob.drops.length > 0)
    .map((mob) => ({
      relativePath: `src/main/resources/data/${spec.modId}/loot_table/entities/${mob.id}.json`,
      encoding: 'utf8' as const,
      contents: entityLootJson(spec, mob)
    }))
}

export function planItemLootFiles(spec: ProjectSpec): PlannedFile[] {
  if (spec.items.length === 0) {
    return []
  }
  return [
    {
      relativePath: `src/main/resources/data/${spec.modId}/loot_table/chests/${spec.modId}_bonus.json`,
      encoding: 'utf8',
      contents: `${JSON.stringify(
        {
          type: 'minecraft:chest',
          pools: [
            {
              rolls: 1.0,
              entries: spec.items.map((item) => ({
                type: 'minecraft:item',
                name: `${spec.modId}:${item.id}`,
                weight: 1
              }))
            }
          ]
        },
        null,
        2
      )}\n`
    }
  ]
}

export function lootDoc(spec: ProjectSpec): string {
  const mobs = spec.mobs
    .filter((mob) => mob.drops.length > 0)
    .map((mob) => `- ${mob.id}: ${mob.drops.map((drop) => `${drop.itemId} ${drop.min}-${drop.max} @${drop.chance}`).join(', ')}`)
    .join('\n')
  return [
    '# Loot tables',
    '',
    'Mods emit JSON at `data/<modid>/loot_table/` (1.21 singular path). Entity tables match the entity id automatically.',
    `Chest bonus table \`${spec.modId}:chests/${spec.modId}_bonus\` lists spec items but is **not** injected into vanilla chests.`,
    'Plugins cannot register datapack loot tables; they drop from EntityDeathEvent when the disguise PDC matches.',
    mobs || '- No mob drop lists in this spec.',
    ''
  ].join('\n')
}

export function planLootDocs(spec: ProjectSpec): PlannedFile[] {
  if (spec.mobs.every((mob) => mob.drops.length === 0) && spec.items.length === 0) {
    return []
  }
  return [{ relativePath: 'LOOT.md', encoding: 'utf8', contents: lootDoc(spec) }]
}

export function pluginLootListenerJava(spec: ProjectSpec, mainClass: string, style: 'adventure' | 'legacy'): string {
  if (!spec.mobs.some((mob) => mob.drops.length > 0)) {
    return ''
  }
  const cases = spec.mobs
    .filter((mob) => mob.drops.length > 0)
    .map((mob) => {
      const drops = mob.drops
        .map((drop) => {
          const stack = drop.itemId.startsWith('minecraft:')
            ? `new org.bukkit.inventory.ItemStack(org.bukkit.Material.${vanillaItemConstant(drop.itemId)}, count)`
            : `${mainClass === spec.mainClass ? 'this.plugin' : 'this.plugin'}.${`create${toConstName(drop.itemId).replace(/_/g, '')}`}()`
          if (drop.itemId.startsWith('minecraft:')) {
            return `        if (Math.random() <= ${drop.chance}d) {
          int count = ${drop.min} + (int) Math.floor(Math.random() * ${drop.max - drop.min + 1});
          event.getDrops().add(${stack});
        }`
          }
          return `        if (Math.random() <= ${drop.chance}d) {
          event.getDrops().add(((${spec.mainClass}) this.plugin).create${toConstName(drop.itemId).replace(/_/g, '')}());
        }`
        })
        .join('\n')
      return `      case "${mob.id}" -> {
${drops}
      }`
    })
    .join('\n')
  const unused = style === 'adventure' ? '' : ''
  return `
  public static final class CraftStudioDropsListener implements org.bukkit.event.Listener {
    private final org.bukkit.plugin.java.JavaPlugin plugin;

    public CraftStudioDropsListener(org.bukkit.plugin.java.JavaPlugin plugin) {
      this.plugin = plugin;
    }

    @org.bukkit.event.EventHandler
    public void onDeath(org.bukkit.event.entity.EntityDeathEvent event) {
      String id = event.getEntity().getPersistentDataContainer().get(MOB_KEY, org.bukkit.persistence.PersistentDataType.STRING);
      if (id == null) {
        return;
      }
      switch (id) {
${cases}
        default -> {
        }
      }
    }
  }
${unused}`
}

export function pluginLootRegister(): string {
  return `    getServer().getPluginManager().registerEvents(new CraftStudioDropsListener(this), this);`
}
