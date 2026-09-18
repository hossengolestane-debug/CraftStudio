import type { ProjectSpec, SpecMob, SpecPluginGui } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import { javaEscape } from '../wrapper'

export type BukkitTextStyle = 'adventure' | 'legacy'

export const PAPER_ONLY_MARKERS = [
  'io.papermc',
  'net.kyori',
  'paper-api',
  'Component.text',
  'CustomModelDataComponent',
  'net.kyori.adventure',
  'Paper.custom'
]

export function vanillaMaterial(id: string): string {
  return id.replace(/^minecraft:/, '').toUpperCase()
}

export function disguiseType(mob: SpecMob): string {
  const base = mob.appearance.vanillaBase.replace('minecraft:', '').toUpperCase()
  if (base === 'ZOMBIE' || base === 'PIG' || base === 'WOLF') {
    return base
  }
  return 'ZOMBIE'
}

export function itemFactoryMethod(_spec: ProjectSpec, itemId: string): string {
  return `create${toConstName(itemId).replace(/_/g, '')}`
}

export function pluginGuiClass(id: string): string {
  return `${id
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join('')}Menu`
}

export function spawnMobJava(spec: ProjectSpec, style: BukkitTextStyle, maxHealthAttribute = 'GENERIC_MAX_HEALTH'): string {
  if (spec.mobs.length === 0) {
    return ''
  }
  const cases = spec.mobs
    .map((mob) => {
      const name =
        style === 'adventure'
          ? `entity.customName(net.kyori.adventure.text.Component.text("${javaEscape(mob.displayName)}"));`
          : `entity.setCustomName("${javaEscape(mob.displayName)}");`
      return `      case "${mob.id}" -> {
        org.bukkit.entity.LivingEntity entity = (org.bukkit.entity.LivingEntity) world.spawnEntity(location, org.bukkit.entity.EntityType.${disguiseType(mob)});
        ${name}
        entity.setCustomNameVisible(true);
        entity.getAttribute(org.bukkit.attribute.Attribute.${maxHealthAttribute}).setBaseValue(${mob.health}d);
        entity.setHealth(${mob.health}d);
        entity.getPersistentDataContainer().set(MOB_KEY, org.bukkit.persistence.PersistentDataType.STRING, "${javaEscape(mob.id)}");
        // ${mob.preset} / ${mob.targeting} — preset is documented only; plugins cannot register a new client entity type.
        yield entity;
      }`
    })
    .join('\n')
  return `
  public org.bukkit.entity.LivingEntity spawnCustomMob(org.bukkit.World world, org.bukkit.Location location, String id) {
    return switch (id) {
${cases}
      default -> null;
    };
  }
`
}

export function pluginGuiJava(spec: ProjectSpec, gui: SpecPluginGui, style: BukkitTextStyle): string {
  const cls = pluginGuiClass(gui.id)
  const titleExpr =
    style === 'adventure'
      ? `net.kyori.adventure.text.Component.text("${javaEscape(gui.title)}")`
      : `"${javaEscape(gui.title)}"`
  const nameSet =
    style === 'adventure'
      ? 'meta.displayName(net.kyori.adventure.text.Component.text(slot.label()));'
      : 'meta.setDisplayName(slot.label());'
  const slots = gui.slots
    .map((slot) => {
      const mat =
        slot.iconKind === 'vanilla' ? `org.bukkit.Material.${vanillaMaterial(slot.iconId)}` : 'org.bukkit.Material.PAPER'
      return `      new SlotSpec(${slot.index}, ${mat}, "${javaEscape(slot.label)}", "${slot.action}", ${
        slot.giveItemId ? `"${slot.giveItemId}"` : 'null'
      }, ${slot.permission ? `"${javaEscape(slot.permission)}"` : 'null'})`
    })
    .join(',\n')
  return `package ${spec.packageName};

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Plugin inventory menu preview. Click/drag/transfer are cancelled.
 * Pagination is a stub button. This is not a Minecraft-verified GUI.
 */
public final class ${cls} implements InventoryHolder, Listener {
  private final JavaPlugin plugin;
  private final Inventory inventory;

  private record SlotSpec(int index, org.bukkit.Material icon, String label, String action, String giveItemId, String permission) {}

  private static final SlotSpec[] SLOTS = {
${slots}
  };

  public ${cls}(JavaPlugin plugin) {
    this.plugin = plugin;
    this.inventory = Bukkit.createInventory(this, ${gui.rows * 9}, ${titleExpr});
    for (SlotSpec slot : SLOTS) {
      ItemStack stack = new ItemStack(slot.icon());
      var meta = stack.getItemMeta();
      ${nameSet}
      stack.setItemMeta(meta);
      inventory.setItem(slot.index(), stack);
    }
    ${
      gui.pagination
        ? '// Pagination stub: the last-row "next" control does not change pages in Phase 5.'
        : ''
    }
  }

  @Override
  public Inventory getInventory() {
    return inventory;
  }

  public void open(Player player) {
    player.openInventory(inventory);
  }

  @EventHandler
  public void onClick(InventoryClickEvent event) {
    if (!(event.getInventory().getHolder() instanceof ${cls})) {
      return;
    }
    event.setCancelled(true);
    if (!(event.getWhoClicked() instanceof Player player)) {
      return;
    }
    for (SlotSpec slot : SLOTS) {
      if (event.getRawSlot() != slot.index()) {
        continue;
      }
      if (slot.permission() != null && !player.hasPermission(slot.permission())) {
        player.sendMessage("Missing permission " + slot.permission());
        return;
      }
      switch (slot.action()) {
        case "close" -> player.closeInventory();
        case "message" -> player.sendMessage("CraftStudio menu: " + slot.label());
        case "give" -> player.sendMessage("Give action bound to " + slot.giveItemId() + " (apply items to receive a stack).");
        default -> player.sendMessage(${gui.pagination ? '"Pagination stub — no extra pages."' : '"No action."'});
      }
      return;
    }
  }

  @EventHandler
  public void onDrag(InventoryDragEvent event) {
    if (event.getInventory().getHolder() instanceof ${cls}) {
      event.setCancelled(true);
    }
  }
}
`
}
