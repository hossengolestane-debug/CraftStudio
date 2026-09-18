import type { ProjectSpec } from '../../../shared/spec'
import type { PlannedFile } from '../types'
import { javaEscape } from '../wrapper'

export type ForgeLikeFlavor = 'forge' | 'neoforge'

function firstGui(spec: ProjectSpec) {
  return spec.modGuis[0]
}

export function forgeLikeMenuFields(spec: ProjectSpec, flavor: ForgeLikeFlavor): string {
  if (!firstGui(spec)) {
    return ''
  }
  if (flavor === 'neoforge') {
    return `  public static final DeferredRegister<MenuType<?>> MENUS = DeferredRegister.create(Registries.MENU, MOD_ID);
  public static final DeferredHolder<MenuType<?>, MenuType<ExampleMenu>> EXAMPLE_MENU = MENUS.register("example_menu",
    () -> IMenuTypeExtension.create((windowId, inv, buf) -> new ExampleMenu(windowId, inv)));`
  }
  return `  public static final DeferredRegister<MenuType<?>> MENUS = DeferredRegister.create(ForgeRegistries.MENU_TYPES, MOD_ID);
  public static final RegistryObject<MenuType<ExampleMenu>> EXAMPLE_MENU = MENUS.register("example_menu",
    () -> IForgeMenuType.create((windowId, inv, data) -> new ExampleMenu(windowId, inv)));`
}

export function planForgeLikeMenuFiles(
  spec: ProjectSpec,
  packagePath: string,
  flavor: ForgeLikeFlavor,
  options: { omitEventBusSubscriberBus?: boolean } = {}
): PlannedFile[] {
  const gui = firstGui(spec)
  if (!gui) {
    return []
  }
  const labels = gui.widgets
    .filter((widget) => widget.kind === 'label')
    .map(
      (widget) =>
        `    graphics.drawString(this.font, "${javaEscape(widget.text || widget.id)}", this.leftPos + ${widget.x}, this.topPos + ${widget.y}, 0x404040, false);`
    )
    .join('\n')
  const slotComment = gui.widgets
    .filter((widget) => widget.kind === 'slot')
    .map((widget) => `    // Designer slot "${widget.id}" at ${widget.x},${widget.y} — server validates mayPlace; client clicks are untrusted.`)
    .join('\n')
  const closeY = Math.max(20, gui.height - 36)
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
    event.register(${spec.mainClass}.EXAMPLE_MENU.get(), ExampleScreen::new);
  }
}`
      : `@Mod.EventBusSubscriber(modid = ${spec.mainClass}.MOD_ID, bus = Mod.EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
public final class ClientScreens {
  private ClientScreens() {}

  @SubscribeEvent
  public static void clientSetup(FMLClientSetupEvent event) {
    event.enqueueWork(() -> MenuScreens.register(${spec.mainClass}.EXAMPLE_MENU.get(), ExampleScreen::new));
  }
}`

  return [
    {
      relativePath: `src/main/java/${packagePath}/ExampleMenu.java`,
      encoding: 'utf8',
      contents: `package ${spec.packageName};

import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

/**
 * Server-side container for "${javaEscape(gui.title)}".
 * Client clicks are not trusted. Slot movement is validated here; shift-click transfer is refused.
 */
public class ExampleMenu extends AbstractContainerMenu {
  public ExampleMenu(int id, Inventory playerInventory) {
    super(${spec.mainClass}.EXAMPLE_MENU.get(), id);
${slotComment || '    // Designer had no slot widgets; one preview slot is still created for the layout.'}
    this.addSlot(new Slot(playerInventory, 0, 80, 60) {
      @Override
      public boolean mayPlace(ItemStack stack) {
        return !stack.isEmpty() && stack.getCount() <= 64;
      }
    });
    for (int row = 0; row < 3; row++) {
      for (int col = 0; col < 9; col++) {
        this.addSlot(new Slot(playerInventory, col + row * 9 + 9, 8 + col * 18, 84 + row * 18));
      }
    }
    for (int col = 0; col < 9; col++) {
      this.addSlot(new Slot(playerInventory, col, 8 + col * 18, 142));
    }
  }

  @Override
  public boolean stillValid(Player player) {
    return true;
  }

  @Override
  public ItemStack quickMoveStack(Player player, int index) {
    return ItemStack.EMPTY;
  }
}
`
    },
    {
      relativePath: `src/main/java/${packagePath}/ExampleScreen.java`,
      encoding: 'utf8',
      contents: `package ${spec.packageName};

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Inventory;

/**
 * Client preview for "${javaEscape(gui.title)}" (${gui.width}x${gui.height}).
 * This is a layout preview, not a Minecraft-verified GUI. Server-side validation lives in ExampleMenu.
 */
public class ExampleScreen extends AbstractContainerScreen<ExampleMenu> {
  public ExampleScreen(ExampleMenu menu, Inventory inventory, Component title) {
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
  }
}
`
    },
    {
      relativePath: `src/main/java/${packagePath}/ClientScreens.java`,
      encoding: 'utf8',
      contents: `package ${spec.packageName};

${clientPkg}

${clientClass}
`
    }
  ]
}

export function forgeLikeCommandMethod(spec: ProjectSpec): string {
  const gui = firstGui(spec)
  if (!gui) {
    return ''
  }
  return `  private void registerCommands(RegisterCommandsEvent event) {
    event.getDispatcher().register(net.minecraft.commands.Commands.literal("opencustommenu")
      .executes(ctx -> {
        net.minecraft.server.level.ServerPlayer player = ctx.getSource().getPlayerOrException();
        player.openMenu(new net.minecraft.world.SimpleMenuProvider(
          (id, inv, p) -> new ExampleMenu(id, inv),
          net.minecraft.network.chat.Component.literal("${javaEscape(gui.title)}")
        ));
        return 1;
      }));
  }`
}
