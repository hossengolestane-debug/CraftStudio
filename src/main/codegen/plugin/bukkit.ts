import { defaultCommandPermission, defaultMenuPermission } from '../../../shared/spawn'
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

export function pluginCommandPermissionsYml(spec: ProjectSpec): string {
  const lines = ['permissions:']
  lines.push(`  ${spec.modId}.item.give:`)
  lines.push('    description: Give a CraftStudio custom item')
  lines.push('    default: true')
  if (spec.mobs.length) {
    lines.push(`  ${spec.modId}.mob.summon:`)
    lines.push('    description: Summon a CraftStudio vanilla-disguise mob')
    lines.push('    default: op')
  }
  for (const gui of spec.pluginGuis) {
    lines.push(`  ${defaultMenuPermission(spec.modId, gui.id)}:`)
    lines.push(`    description: Open ${gui.title}`)
    lines.push('    default: true')
  }
  for (const command of spec.commands) {
    const node = command.permission?.trim() || defaultCommandPermission(spec.modId, command.name)
    lines.push(`  ${node}:`)
    lines.push(`    description: ${command.description || command.name}`)
    lines.push('    default: op')
  }
  return lines.join('\n')
}

export function pluginRecipeRegistration(spec: ProjectSpec): string {
  return spec.recipes
    .map((recipe) => {
      const resultMethod = `create${toConstName(recipe.resultItemId).replace(/_/g, '')}`
      if (recipe.type === 'shaped') {
        const shape = recipe.pattern.map((row) => `"${row}"`).join(', ')
        const keys = recipe.keys
          .map((key) =>
            key.kind === 'vanilla'
              ? `    recipe_${recipe.id}.setIngredient('${key.symbol}', org.bukkit.Material.${vanillaMaterial(key.id)});`
              : `    // Mod-item shaped keys are not plugin materials; skipped ${key.id}`
          )
          .join('\n')
        return `    org.bukkit.inventory.ShapedRecipe recipe_${recipe.id} = new org.bukkit.inventory.ShapedRecipe(new org.bukkit.NamespacedKey(this, "${recipe.id}"), ${resultMethod}());
    recipe_${recipe.id}.shape(${shape});
${keys}
    getServer().addRecipe(recipe_${recipe.id});`
      }
      const ingredients = recipe.ingredients
        .map((ingredient) => {
          if (ingredient.kind !== 'vanilla') {
            return `    // Mod-item ingredients are not plugin materials; skipped ${ingredient.id}`
          }
          return `    recipe_${recipe.id}.addIngredient(org.bukkit.Material.${vanillaMaterial(ingredient.id)});`
        })
        .join('\n')
      return `    org.bukkit.inventory.ShapelessRecipe recipe_${recipe.id} = new org.bukkit.inventory.ShapelessRecipe(new org.bukkit.NamespacedKey(this, "${recipe.id}"), ${resultMethod}());
${ingredients}
    getServer().addRecipe(recipe_${recipe.id});`
    })
    .join('\n')
}

export function pluginTabCompleteJava(spec: ProjectSpec): string {
  const itemIds = spec.items.map((item) => `"${item.id}"`).join(', ')
  const mobIds = spec.mobs.map((mob) => `"${mob.id}"`).join(', ')
  const menuIds = spec.pluginGuis.map((gui) => `"${gui.id}"`).join(', ')
  const commandNames = spec.commands.map((command) => `"${command.name}"`).join(', ')
  return `
  @Override
  public java.util.List<String> onTabComplete(org.bukkit.command.CommandSender sender, org.bukkit.command.Command command, String alias, String[] args) {
    String label = command.getName();
    if (args.length != 1) {
      return java.util.List.of();
    }
    String prefix = args[0].toLowerCase();
    java.util.List<String> options = new java.util.ArrayList<>();
    if (label.equalsIgnoreCase("givecustomitem")) {
      options.addAll(java.util.List.of(${itemIds || '""'}));
    } else if (label.equalsIgnoreCase("summoncustom")) {
      options.addAll(java.util.List.of(${mobIds || '""'}));
    } else if (label.equalsIgnoreCase("opencustommenu")) {
      options.addAll(java.util.List.of(${menuIds || '""'}));
    } else if (java.util.List.of(${commandNames || '""'}).contains(label.toLowerCase())) {
      options.addAll(java.util.List.of(${itemIds || '""'}));
    }
    return options.stream().filter(option -> !option.isEmpty() && option.startsWith(prefix)).toList();
  }
`
}

export function pluginGuiJava(spec: ProjectSpec, gui: SpecPluginGui, style: BukkitTextStyle): string {
  const cls = pluginGuiClass(gui.id)
  const titleExpr =
    style === 'adventure'
      ? `net.kyori.adventure.text.Component.text("${javaEscape(gui.title)}" + suffix)`
      : `"${javaEscape(gui.title)}" + suffix`
  const nameSet =
    style === 'adventure'
      ? 'meta.displayName(net.kyori.adventure.text.Component.text(label));'
      : 'meta.setDisplayName(label);'
  const slots = gui.slots
    .map((slot) => {
      const mat =
        slot.iconKind === 'vanilla' ? `org.bukkit.Material.${vanillaMaterial(slot.iconId)}` : 'org.bukkit.Material.PAPER'
      return `      new SlotSpec(${slot.index}, ${mat}, "${javaEscape(slot.label)}", "${slot.action}", ${
        slot.giveItemId ? `"${slot.giveItemId}"` : 'null'
      }, ${slot.permission ? `"${javaEscape(slot.permission)}"` : 'null'})`
    })
    .join(',\n')
  const size = gui.rows * 9
  const pageSize = gui.pagination ? Math.max(1, size - 2) : size
  const prevSlot = size - 2
  const nextSlot = size - 1
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
 * Plugin inventory menu. Click, drag, and shift-transfer are cancelled.
 * Pagination rebuilds pages when slots overflow the chest size.
 * This is not a Minecraft-verified GUI.
 */
public final class ${cls} implements InventoryHolder, Listener {
  private final JavaPlugin plugin;
  private Inventory inventory;
  private int page;

  private record SlotSpec(int index, org.bukkit.Material icon, String label, String action, String giveItemId, String permission) {}

  private static final SlotSpec[] SLOTS = {
${slots}
  };
  private static final boolean PAGINATION = ${gui.pagination ? 'true' : 'false'};
  private static final int SIZE = ${size};
  private static final int PAGE_SIZE = ${pageSize};
  private static final int PREV_SLOT = ${prevSlot};
  private static final int NEXT_SLOT = ${nextSlot};

  public ${cls}(JavaPlugin plugin) {
    this.plugin = plugin;
    this.page = 0;
    this.inventory = createInventory("");
    render();
  }

  private Inventory createInventory(String suffix) {
    return Bukkit.createInventory(this, SIZE, ${titleExpr});
  }

  private ItemStack icon(org.bukkit.Material material, String label) {
    ItemStack stack = new ItemStack(material);
    var meta = stack.getItemMeta();
    ${nameSet}
    stack.setItemMeta(meta);
    return stack;
  }

  private int maxPage() {
    if (!PAGINATION || SLOTS.length == 0) {
      return 0;
    }
    return Math.max(0, (SLOTS.length - 1) / PAGE_SIZE);
  }

  private void render() {
    this.page = Math.max(0, Math.min(this.page, maxPage()));
    String suffix = PAGINATION ? " (" + (this.page + 1) + "/" + (maxPage() + 1) + ")" : "";
    this.inventory = createInventory(suffix);
    this.inventory.clear();
    if (PAGINATION) {
      int start = this.page * PAGE_SIZE;
      for (int i = 0; i < PAGE_SIZE && start + i < SLOTS.length; i++) {
        SlotSpec slot = SLOTS[start + i];
        this.inventory.setItem(i, icon(slot.icon(), slot.label()));
      }
      this.inventory.setItem(PREV_SLOT, icon(org.bukkit.Material.ARROW, "Previous"));
      this.inventory.setItem(NEXT_SLOT, icon(org.bukkit.Material.ARROW, "Next"));
    } else {
      for (SlotSpec slot : SLOTS) {
        this.inventory.setItem(slot.index(), icon(slot.icon(), slot.label()));
      }
    }
  }

  @Override
  public Inventory getInventory() {
    return inventory;
  }

  public void open(Player player) {
    if (!this.plugin.isEnabled()) {
      return;
    }
    this.page = 0;
    render();
    player.openInventory(this.inventory);
  }

  private void openPage(Player player, int nextPage) {
    this.page = nextPage;
    render();
    player.openInventory(this.inventory);
  }

  @EventHandler
  public void onClick(InventoryClickEvent event) {
    if (!(event.getInventory().getHolder() instanceof ${cls} holder)) {
      return;
    }
    event.setCancelled(true);
    if (event.getClickedInventory() == null || event.getClickedInventory().getHolder() != holder) {
      return;
    }
    if (!(event.getWhoClicked() instanceof Player player)) {
      return;
    }
    int raw = event.getRawSlot();
    if (PAGINATION && raw == PREV_SLOT) {
      holder.openPage(player, holder.page - 1);
      return;
    }
    if (PAGINATION && raw == NEXT_SLOT) {
      holder.openPage(player, holder.page + 1);
      return;
    }
    SlotSpec slot;
    if (PAGINATION) {
      int index = holder.page * PAGE_SIZE + raw;
      if (index < 0 || index >= SLOTS.length || raw >= PAGE_SIZE) {
        return;
      }
      slot = SLOTS[index];
    } else {
      slot = null;
      for (SlotSpec candidate : SLOTS) {
        if (candidate.index() == raw) {
          slot = candidate;
          break;
        }
      }
      if (slot == null) {
        return;
      }
    }
    if (slot.permission() != null && !player.hasPermission(slot.permission())) {
      player.sendMessage("Missing permission " + slot.permission());
      return;
    }
    switch (slot.action()) {
      case "close" -> player.closeInventory();
      case "message" -> player.sendMessage("CraftStudio menu: " + slot.label());
      case "give" -> player.sendMessage("Give action bound to " + slot.giveItemId() + " (apply items to receive a stack).");
      default -> player.sendMessage("No action.");
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
