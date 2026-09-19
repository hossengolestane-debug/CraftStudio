# Phase 8 report

Phase 8 keeps the Phase 1–7 Electron app and adds a trusted-template worldgen MVP (vanilla ore veins), item durability + a small attribute set, shaped recipes, JSON loot tables, richer menu data-slot sync, two new mob presets, Linux/macOS packaging scripts, Design undo, a recent-projects list, and a dependency/cache doctor. Model output stays untrusted. Compile success is still not Tested. Packages stay unsigned unless a real certificate exists (none in this environment).

## What works

### Worldgen MVP
- Spec `worldgen[]` (max 4) is `ore_vein` only: allowlisted vanilla ores, size/count/Y, optional biome allowlist.
- Mods emit `configured_feature` + `placed_feature` JSON. Deepslate counterparts are included for the stone/deepslate ore tags.
- Fabric: `BiomeModifications.addFeature(..., UNDERGROUND_ORES, ...)`.
- Forge / NeoForge: `forge:add_features` / `neoforge:add_features` biome modifiers.
- Paper / Spigot: `worldgen` capability is **unsupported**. Apply **rejects** ore-vein entries. `WORLDGEN.md` is honest — no fake ore JSON.
- This is not a dimension or structure stack.

### Items / loot / recipes
- Item `durability` (`maxDamage` / `durability()`). Stack size must be 1 when durability > 0.
- Up to four attributes: attack_damage, attack_speed, armor, max_health, movement_speed (classic `GENERIC_*` on Fabric 1.21/1.21.1; modern names on 1.21.2+ and Forge/NeoForge).
- Recipes are `shapeless` or `shaped` with pattern + A–Z keys. Validation rejects unused keys and unknown ingredients.
- Mods emit 1.21 `loot_table/entities/<mob>.json` from `mob.drops`, plus a documented chest bonus table that is **not** injected into vanilla chests.
- Plugins register `ShapedRecipe` and drop from `EntityDeathEvent` when the disguise PDC matches. Paper items stay paper disguises — no fake tool durability.

### Menu sync subset
- Fabric `ArrayPropertyDelegate` + `addProperties`.
- Forge / NeoForge `SimpleContainerData` + `addDataSlots`.
- Client screens draw synced numbers and an optional ghost item when the first slot is empty.
- Server remains authoritative. Multi-screen Phase 7 projects still emit every screen.

### Behavior presets
- Cap: **7** presets (`MOB_PRESET_CAP`). Not a behavior tree.
- New: `follow_player` (look-at + wander; not tameable follow-owner) and `leap_melee` (Yarn `PounceAtTargetGoal`, official mappings `LeapAtTargetGoal` + melee).
- Plugins remain vanilla disguises.

### Production polish
- `dist:linux` (dir + AppImage) and `dist:mac` (dir). Unsigned. Linux agents cannot produce a signed or notarized macOS app; AppImage may work on Linux x64.
- Design editors keep a 20-step undo/redo stack (Ctrl/Cmd+Z / Y). Apply still snapshots.
- Projects page: existing filter plus a Recent list (last opened + newest).
- Doctor: JDK major, vendored wrapper (`gradlew` + properties + jar), and offline cache hints from the last build log.
- Test tab lists the five evidence steps and what gets recorded. Compile-only still cannot write Tested.

## What was tested

Automated:

- Spec validation for durability, shaped keys, worldgen Y-range
- Fabric / Forge / NeoForge goldens for ore JSON, shaped recipes, entity + chest bonus loot, durability/attributes, new presets, menu data slots
- Plugin worldgen rejection + honest WORLDGEN.md when the prompt asked for ores + shaped recipe + death-drop listener
- Design undo stack (20 steps) and Ollama JSON schema coverage for durability / worldgen
- Doctor JDK / wrapper / cache findings
- Existing Phase 1–7 suites

Manual / agent: see “Live notes” after compile runs in this environment.

## Known limitations

- Ore veins place vanilla blocks only (no custom block registration)
- Item attributes are a conservative subset; not a full equipment API
- Chest bonus loot is emitted but not injected into vanilla chests
- `follow_player` is look-and-wander, not owner-follow
- Forge codegen is 1.21.1 only; Spigot 1.21.8 is unsupported
- Packages are unsigned
- Compatibility stays Experimental until a desktop Minecraft runtime is recorded as evidence

## Security

- Repair and texture paths stay on allowlisted prefixes (`WORLDGEN.md`, `LOOT.md` added)
- Gradle args remain `build` or `runClient` plus `--no-daemon --stacktrace`
- EULA is never silent-accepted
- Evidence recording still refuses compile-only builds
- Installers from this repo are unsigned

## Recommended Phase 9

1. Record one Tested row on a desktop where `runClient` or a real Paper/Spigot server actually finishes.
2. Custom block registration so ore veins can place mod blocks.
3. Dimension / structure / configured-feature kinds beyond `minecraft:ore`.
4. Global loot modifiers that actually inject the bonus chest table.
5. A capped composable goal list (still not an unrestricted behavior tree).
6. Signed Windows/macOS installers and auto-update — only with real certificates.
7. 1.21.11+ / 26.x mapping updates when official templates settle.

## Live notes

Recorded in this cloud environment after apply + `./gradlew build --no-daemon --stacktrace`. Compile-only remains `true`. No `craftstudio.runtime-evidence.json` was written from compile-only.

| Project | Result |
| --- | --- |
| Fabric 1.21.4 Phase 8 slice (durability + attribute, shaped recipe, ore vein, leap_melee + follow_player, two screens + data slot) at `/tmp/cs-phase8-projects/fabric214` | First compile failed (Yarn has `PounceAtTargetGoal`, not `LeapAtTargetGoal`). After that template fix, **BUILD SUCCESSFUL** in 7s. |
| Forge 1.21.1 same slice at `/tmp/cs-phase8-projects/forge1211` | **BUILD SUCCESSFUL** in 10s (`LeapAtTargetGoal` is the official-mapping name). |
| NeoForge 1.21.4 same slice at `/tmp/cs-phase8-projects/neo214` | **BUILD SUCCESSFUL** in 7s (`EventBusSubscriber.bus` deprecated warnings only). |
| `npm run dist:linux` | Unsigned `release/CraftStudio Local-0.8.0.AppImage` (~131MB) plus `release/linux-unpacked`. Default Electron icon. Not signed. |
| `npm run dist:mac` | electron-builder wrote an unsigned `release/mac/CraftStudio Local.app` directory on Linux and **skipped code signing** (`supported only on macOS`). This is not a notarized installer and is not a signed certificate claim. |

This environment did **not** complete a Minecraft client. Compatibility stays Experimental.
