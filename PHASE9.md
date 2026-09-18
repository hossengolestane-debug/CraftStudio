# Phase 9 report

Phase 9 keeps the Phase 1–8 Electron app and adds cube-all custom blocks, allowlisted chest loot injection on mods, a capped composable mob goal list, and a second worldgen kind (`minecraft:random_patch`). Model output stays untrusted. Compile success is still not Tested. Packages stay unsigned unless a real certificate exists (none in this environment).

## What shipped

- **Custom blocks** — spec + Design editor: id, display name, material/sound preset, hardness/resistance, drop (`self` or an existing item id). Emitters write `Block` + `BlockItem`, blockstate, cube-all model, block loot table, and lang. Cap: 4. Ids must be unique versus items.
- **Block textures** — Assets reuses the pixel editor for cube-all `layer0`. Apply / pack export swap the stone fallback when a painted PNG exists.
- **Ore veins can place a spec block** — `ore_vein` still uses `minecraft:ore`. Vanilla ores keep a deepslate counterpart; a spec block is placed as-is in both stone and deepslate replaceables.
- **Chest injection** — Fabric uses `LootTableEvents.MODIFY` (loot-api-v2 on 1.21/1.21.1, v3 on 1.21.2+). Forge/NeoForge emit `AddBonusChestModifier` plus `global_loot_modifiers.json`. Allowlist only: `minecraft:chests/simple_dungeon`, `abandoned_mineshaft`, `spawn_bonus_chest`, `village/village_toolsmith`.
- **Composable goals** — max 5 from `wander`, `look_player`, `melee`, `flee`, `avoid_player`, `leap`, `follow_look`. Empty lists expand from the existing presets. Not a behavior tree.
- **Surface patches** — `surface_patch` emits `minecraft:random_patch` + `simple_block` on air, heightmap `MOTION_BLOCKING`. Fabric step `VEGETAL_DECORATION`; Forge/NeoForge `vegetal_decoration`.
- **Plugins** — apply rejects blocks and worldgen. No vanilla-block disguise. No chest injection. Honest `BLOCKS.md` / `WORLDGEN.md` / `LOOT.md` / `INSTALL.md`.
- **Migration** — adding blocks on a mod pin is noted; switching a block spec to Paper/Spigot is incompatible.
- Phase 8 doctor, undo, snapshots, packaging, and evidence-gated Tested stay in place.

## Honesty

- Plugin custom blocks are **unsupported**. They are not equal to mod blocks.
- Chest injection is **mod-only** and allowlisted. Plugins do not inject vanilla chests.
- Goal lists are a hard-capped allowlist. This is not an unrestricted AI behavior tree.
- `surface_patch` is not a dimension or structure stack. No fake custom dimensions.
- Compile-only Gradle never writes `craftstudio.runtime-evidence.json` and never flips **Tested**.
- Packages remain unsigned without a real certificate. Forge is not NeoForge. Paper is not Spigot.

## Pins (unchanged)

| Adapter | Emitted pins |
| --- | --- |
| Fabric | 1.21, 1.21.1 (classic `Registry.register`), 1.21.2 / 1.21.4 / 1.21.8 (`Items.register` + `RegistryKey`; blocks also take `.registryKey`) |
| Forge | 1.21.1 only (Forge 52.1.16, ForgeGradle 6.0.36) |
| NeoForge | 1.21.1 / 1.21.4 / 1.21.8 |
| Paper / Spigot | same 1.21.x pins as Phase 8; blocks and worldgen rejected |

## Recommended Phase 10

1. Record one Tested row on a desktop where `runClient` or a real Paper/Spigot server actually finishes.
2. Multipart blockstates, slabs/stairs, or a tiny inventory-capable block — only if the pin APIs stay compiling.
3. One more configured-feature kind (lake / spring) or a **minimal experimental** dimension stub with honest labeling — not a full world stack.
4. Goal priorities / target selectors beyond the current seven-id allowlist, still capped.
5. Signed Windows/macOS installers and auto-update — only with real certificates.
6. 1.21.11+ / 26.x mapping updates when official templates settle.

## Live notes

Recorded in this cloud environment after emit + `./gradlew build --no-daemon --stacktrace`. Compile-only remains `true`. No `craftstudio.runtime-evidence.json` was written from compile-only.

| Project | Result |
| --- | --- |
| Fabric 1.21.1 Phase 9 slice (cube-all block, mod-block ore vein, dandelion surface patch, composable goals, loot-api-v2 chest inject) at `/tmp/cs-phase9-projects/fabric1211` | First compile failed (`BlockItem` is Yarn `net.minecraft.item.BlockItem`, not `net.minecraft.block.BlockItem`). After that import fix, **BUILD SUCCESSFUL** in 7s. Deprecation notes only. |
| Forge 1.21.1 same slice at `/tmp/cs-phase9-projects/forge1211` | **BUILD SUCCESSFUL** in 16s (`AddBonusChestModifier` + cube-all block + surface-patch biome modifier). |

This environment did **not** complete a Minecraft client. Compatibility stays Experimental.
