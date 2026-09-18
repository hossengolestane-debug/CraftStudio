import { vanillaItemConstant } from '../../../shared/itemStats'
import { defaultCommandPermission } from '../../../shared/spawn'
import type { ProjectSpec, SpecModGui } from '../../../shared/spec'
import { toConstName } from '../../../shared/spec'
import { forgeMenuClass, forgeScreenClass, menuFieldName, menuRegistryName } from '../naming'
import type { PlannedFile } from '../types'
import { javaEscape } from '../wrapper'

export type ForgeLikeFlavor = 'forge' | 'neoforge'

function customSlotCount(gui: SpecModGui): number {
  return Math.max(1, gui.widgets.filter((widget) => widget.kind === 'slot').length)
}

export function forgeLikeMenuFields(spec: ProjectSpec, flavor: ForgeLikeFlavor): string {
  if (spec.modGuis.length === 0) {
    return ''
  }
  const register = spec.modGuis
    .map((gui) => {
      const menu = forgeMenuClass(gui.id)
      const field = menuFieldName(gui.id)
      const registry = menuRegistryName(gui.id)
      if (flavor === 'neoforge') {
        return `  public static final DeferredHolder<MenuType<?>, MenuType<${menu}>> ${field} = MENUS.register("${registry}",
    () -> IMenuTypeExtension.create((windowId, inv, buf) -> new ${menu}(windowId, inv)));`
      }
      return `  public static final RegistryObject<MenuType<${menu}>> ${field} = MENUS.register("${registry}",
    () -> IForgeMenuType.create((windowId, inv, data) -> new ${menu}(windowId, inv)));`
    })
    .join('\n')
  if (flavor === 'neoforge') {
    return `  public static final DeferredRegister<MenuType<?>> MENUS = DeferredRegister.create(Registries.MENU, MOD_ID);
${register}`
  }
  return `  public static final DeferredRegister<MenuType<?>> MENUS = DeferredRegister.create(ForgeRegistries.MENU_TYPES, MOD_ID);
${register}`
}

function menuJava(spec: ProjectSpec, gui: SpecModGui): string {
  const menu = forgeMenuClass(gui.id)
  const field = menuFieldName(gui.id)
  const slots = customSlotCount(gui)
  const dataCount = Math.max(1, gui.dataSlots.length)
  const slotComments = gui.widgets
    .filter((widget) => widget.kind === 'slot')
    .map((widget) => `    // Designer slot "${widget.id}" at ${widget.x},${widget.y} — server validates mayPlace; client clicks are untrusted.`)
    .join('\n')
  const slotAdds = Array.from({ length: slots }, (_, index) => {
    const widget = gui.widgets.filter((entry) => entry.kind === 'slot')[index]
    const x = widget?.x ?? 80
    const y = widget?.y ?? 60
    return `    this.addSlot(new Slot(this.container, ${index}, ${x}, ${y}) {
      @Override
      public boolean mayPlace(ItemStack stack) {
        return !stack.isEmpty() && stack.getCount() <= stack.getMaxStackSize();
      }
    });`
  }).join('\n')
  const dataInits = gui.dataSlots
    .map((slot, index) => `    this.dataSlots.set(${index}, ${slot.initial});`)
    .join('\n')
  return `package ${spec.packageName};

import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ContainerData;
import net.minecraft.world.inventory.SimpleContainerData;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

/**
 * Server-side container for "${javaEscape(gui.title)}".
 * Client clicks are not trusted. Data slots are server-owned ContainerData values.
 */
public class ${menu} extends AbstractContainerMenu {
  private static final int CUSTOM_SLOTS = ${slots};
  private final SimpleContainer container = new SimpleContainer(CUSTOM_SLOTS);
  private final ContainerData dataSlots = new SimpleContainerData(${dataCount});

  public ${menu}(int id, Inventory playerInventory) {
    super(${spec.mainClass}.${field}.get(), id);
${slotComments || '    // Designer had no slot widgets; one preview slot is still created for the layout.'}
${slotAdds}
    for (int row = 0; row < 3; row++) {
      for (int col = 0; col < 9; col++) {
        this.addSlot(new Slot(playerInventory, col + row * 9 + 9, 8 + col * 18, 84 + row * 18));
      }
    }
    for (int col = 0; col < 9; col++) {
      this.addSlot(new Slot(playerInventory, col, 8 + col * 18, 142));
    }
    this.addDataSlots(this.dataSlots);
${dataInits || `    this.dataSlots.set(0, 0);`}
  }

  public int getSyncedData(int index) {
    return this.dataSlots.get(index);
  }

  @Override
  public boolean stillValid(Player player) {
    return true;
  }

  @Override
  public ItemStack quickMoveStack(Player player, int index) {
    Slot slot = this.slots.get(index);
    if (slot == null || !slot.hasItem()) {
      return ItemStack.EMPTY;
    }
    ItemStack stack = slot.getItem();
    ItemStack original = stack.copy();
    boolean moved;
    if (index < CUSTOM_SLOTS) {
      moved = this.moveItemStackTo(stack, CUSTOM_SLOTS, this.slots.size(), true);
    } else {
      moved = this.moveItemStackTo(stack, 0, CUSTOM_SLOTS, false);
    }
    if (!moved) {
      return ItemStack.EMPTY;
    }
    if (stack.isEmpty()) {
      slot.set(ItemStack.EMPTY);
    } else {
      slot.setChanged();
    }
    return original;
  }

  @Override
  public void removed(Player player) {
    super.removed(player);
    this.clearContainer(player, this.container);
  }
}
`
}

function forgeGhostStack(spec: ProjectSpec, itemId: string): string {
  if (itemId.startsWith('minecraft:')) {
    return `new ItemStack(Items.${vanillaItemConstant(itemId)})`
  }
  return `new ItemStack(${spec.mainClass}.${toConstName(itemId)}.get())`
}

function screenJava(spec: ProjectSpec, gui: SpecModGui): string {
  const menu = forgeMenuClass(gui.id)
  const screen = forgeScreenClass(gui.id)
  const labels = gui.widgets
    .filter((widget) => widget.kind === 'label')
    .map(
      (widget) =>
        `    graphics.drawString(this.font, "${javaEscape(widget.text || widget.id)}", this.leftPos + ${widget.x}, this.topPos + ${widget.y}, 0x404040, false);`
    )
    .join('\n')
  const dataLabels = gui.dataSlots
    .map(
      (slot, index) =>
        `    graphics.drawString(this.font, "${javaEscape(slot.id)}=" + this.menu.getSyncedData(${index}), this.leftPos + 8, this.topPos + ${18 + index * 10}, 0x305030, false);`
    )
    .join('\n')
  const firstSlot = gui.widgets.find((widget) => widget.kind === 'slot')
  const ghost = gui.dataSlots.find((slot) => slot.ghostItemId)
  const ghostDraw =
    ghost?.ghostItemId && firstSlot
      ? `    if (!this.menu.getSlot(0).hasItem()) {
      graphics.renderItem(${forgeGhostStack(spec, ghost.ghostItemId)}, this.leftPos + ${firstSlot.x}, this.topPos + ${firstSlot.y});
    }`
      : ''
  const needsItems = Boolean(ghost?.ghostItemId)
  const closeY = Math.max(20, gui.height - 36)
  return `package ${spec.packageName};

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Inventory;
${needsItems ? 'import net.minecraft.world.item.ItemStack;\nimport net.minecraft.world.item.Items;\n' : ''}
/**
 * Client preview for "${javaEscape(gui.title)}" (${gui.width}x${gui.height}).
 * Ghost items are display-only. Data slot numbers come from the server ContainerData.
 */
public class ${screen} extends AbstractContainerScreen<${menu}> {
  public ${screen}(${menu} menu, Inventory inventory, Component title) {
    super(menu, inventory, title);
    this.imageWidth = ${gui.width};
    this.imageHeight = ${gui.height};
  }

  @Override
  protected void init() {
    super.init();
    this.addRenderableWidget(Button.builder(Component.literal("Close"), button -> this.onClose())
      .bounds(this.leftPos + 48, this.topPos + ${closeY}, 80, 20)
      .build());
  }

  @Override
  protected void renderBg(GuiGraphics graphics, float partialTick, int mouseX, int mouseY) {
    graphics.fill(this.leftPos, this.topPos, this.leftPos + this.imageWidth, this.topPos + this.imageHeight, 0xC0101010);
${labels}
${dataLabels}
${ghostDraw}
  }
}
`
}

function clientScreensJava(
  spec: ProjectSpec,
  flavor: ForgeLikeFlavor,
  options: { omitEventBusSubscriberBus?: boolean }
): string {
  const registrations = spec.modGuis
    .map((gui) => {
      const field = menuFieldName(gui.id)
      const screen = forgeScreenClass(gui.id)
      return flavor === 'neoforge'
        ? `    event.register(${spec.mainClass}.${field}.get(), ${screen}::new);`
        : `      MenuScreens.register(${spec.mainClass}.${field}.get(), ${screen}::new);`
    })
    .join('\n')
  const clientPkg =
    flavor === 'neoforge'
      ? `import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.RegisterMenuScreensEvent;`
      : `import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLClientSetupEvent;
import net.minecraft.client.gui.screens.MenuScreens;`
  const clientClass =
    flavor === 'neoforge'
      ? `@EventBusSubscriber(modid = ${spec.mainClass}.MOD_ID${options.omitEventBusSubscriberBus ? '' : ', bus = EventBusSubscriber.Bus.MOD'}, value = Dist.CLIENT)
public final class ClientScreens {
  private ClientScreens() {}

  @SubscribeEvent
  public static void registerScreens(RegisterMenuScreensEvent event) {
${registrations}
  }
}`
      : `@Mod.EventBusSubscriber(modid = ${spec.mainClass}.MOD_ID, bus = Mod.EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
public final class ClientScreens {
  private ClientScreens() {}

  @SubscribeEvent
  public static void clientSetup(FMLClientSetupEvent event) {
    event.enqueueWork(() -> {
${registrations}
    });
  }
}`
  return `package ${spec.packageName};

${clientPkg}

${clientClass}
`
}

export function planForgeLikeMenuFiles(
  spec: ProjectSpec,
  packagePath: string,
  flavor: ForgeLikeFlavor,
  options: { omitEventBusSubscriberBus?: boolean } = {}
): PlannedFile[] {
  if (spec.modGuis.length === 0) {
    return []
  }
  const files: PlannedFile[] = []
  for (const gui of spec.modGuis) {
    files.push({
      relativePath: `src/main/java/${packagePath}/${forgeMenuClass(gui.id)}.java`,
      encoding: 'utf8',
      contents: menuJava(spec, gui)
    })
    files.push({
      relativePath: `src/main/java/${packagePath}/${forgeScreenClass(gui.id)}.java`,
      encoding: 'utf8',
      contents: screenJava(spec, gui)
    })
  }
  files.push({
    relativePath: `src/main/java/${packagePath}/ClientScreens.java`,
    encoding: 'utf8',
    contents: clientScreensJava(spec, flavor, options)
  })
  return files
}

export function forgeLikeCommandMethod(spec: ProjectSpec): string {
  if (spec.modGuis.length === 0 && spec.commands.length === 0) {
    return ''
  }
  const menuIds = spec.modGuis.map((gui) => `"${javaEscape(gui.id)}"`).join(', ')
  const menuCases = spec.modGuis
    .map((gui) => {
      const menu = forgeMenuClass(gui.id)
      return `        case "${javaEscape(gui.id)}" -> player.openMenu(new net.minecraft.world.SimpleMenuProvider(
          (windowId, inv, p) -> new ${menu}(windowId, inv),
          net.minecraft.network.chat.Component.literal("${javaEscape(gui.title)}")
        ));`
    })
    .join('\n')
  const firstOpen =
    spec.modGuis.length > 0
      ? `        net.minecraft.server.level.ServerPlayer player = ctx.getSource().getPlayerOrException();
        player.openMenu(new net.minecraft.world.SimpleMenuProvider(
          (windowId, inv, p) -> new ${forgeMenuClass(spec.modGuis[0]!.id)}(windowId, inv),
          net.minecraft.network.chat.Component.literal("${javaEscape(spec.modGuis[0]!.title)}")
        ));
        return 1;`
      : '        return 0;'
  const openMenu =
    spec.modGuis.length > 0
      ? `    event.getDispatcher().register(net.minecraft.commands.Commands.literal("opencustommenu")
      .then(net.minecraft.commands.Commands.argument("id", com.mojang.brigadier.arguments.StringArgumentType.word())
        .suggests((ctx, builder) -> {
          for (String id : new String[] {${menuIds}}) {
            if (id.startsWith(builder.getRemaining().toLowerCase())) {
              builder.suggest(id);
            }
          }
          return builder.buildFuture();
        })
        .executes(ctx -> {
          net.minecraft.server.level.ServerPlayer player = ctx.getSource().getPlayerOrException();
          String id = com.mojang.brigadier.arguments.StringArgumentType.getString(ctx, "id");
          switch (id) {
${menuCases}
            default -> ctx.getSource().sendFailure(net.minecraft.network.chat.Component.literal("Unknown menu id."));
          }
          return 1;
        }))
      .executes(ctx -> {
${firstOpen}
      }));`
      : ''
  const specCommands = spec.commands
    .map((command) => {
      const permission = command.permission?.trim() || defaultCommandPermission(spec.modId, command.name)
      const level = command.permission?.trim() ? 2 : 0
      return `    event.getDispatcher().register(net.minecraft.commands.Commands.literal("${javaEscape(command.name)}")
      .requires(source -> source.hasPermission(${level}))
      .executes(ctx -> {
        ctx.getSource().sendSuccess(() -> net.minecraft.network.chat.Component.literal("CraftStudio command /${javaEscape(command.name)} (${javaEscape(permission)})"), false);
        return 1;
      }));`
    })
    .join('\n')
  return `  private void registerCommands(RegisterCommandsEvent event) {
${openMenu}
${specCommands}
  }`
}
