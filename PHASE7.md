# Phase 7 report

Phase 7 keeps the Phase 1–6 Electron app and adds visible client entity renderers, multiple container screens with safer transfers, working plugin pagination, biome spawn tables (not worldgen), real command registration, Windows packaging, and a first-run checklist. Model output stays untrusted. Compile success is still not Tested.

## What works

### Visible entity clients
- Fabric 1.21 / 1.21.1: unchanged compiling cube + `MobEntityRenderer`.
- Fabric 1.21.2+: the invisible render-state stub is replaced by `LivingEntityRenderer` + `CraftStudioMobModel` (cube). 1.21.8 uses a `super(root)` model constructor.
- Forge 1.21.1 and NeoForge 1.21.1: `HierarchicalModel` + `MobRenderer` + `EntityRenderersEvent`.
- NeoForge 1.21.4 / 1.21.8: Mojang render-state `LivingEntityRenderer`. 1.21.8 still omits `EventBusSubscriber.bus`.
- Paper / Spigot stay vanilla disguises. The UI and `biomeSpawns` capability say so.

### Multi-screen GUIs + transfer safety
- Every `modGuis` entry emits its own Screen + Menu/ScreenHandler pair (`example_screen` still maps to `ExampleScreen` / `ExampleMenu`).
- `quickMove` / `quickMoveStack` use `insertItem` / `moveItemStackTo` and refuse illegal moves server-side.
- `/opencustommenu [id]` is registered on Fabric, Forge, and NeoForge with tab suggestions.
- Plugin menus cancel click / drag / shift-transfer. Pagination rebuilds pages when slots overflow (`PAGE_SIZE = rows×9−2`).

### Spawn / biome tables
- Spec `mob.spawn` allowlists plains, forest, desert, taiga, savanna, jungle, swamp, snowy_plains.
- Fabric: `BiomeModifications.addSpawn`.
- Forge / NeoForge: `forge:add_spawns` / `neoforge:add_spawns` JSON biome modifiers.
- Plugins: `SPAWNS.md` + `biomeSpawns: unsupported`. Not a worldgen stack.

### Commands & permissions
- Fabric / Forge / NeoForge register spec commands (not “recorded only”).
- Paper / Spigot: `plugin.yml` permission nodes, `onTabComplete`, and runtime `hasPermission` checks.
- INSTALL.md lists permission nodes (`<modid>.command.<name>`, `<modid>.item.give`, `<modid>.mob.summon`, `<modid>.menu.<id>`).

### Packaging & desktop readiness
- `npm run dist:win` (electron-builder Windows portable + NSIS). Unsigned. Linux agents may only produce portable/`--dir`.
- First-run checklist on the Projects page: JDK, Ollama, projects folder, EULA awareness. Dismiss is local-only and does not skip the EULA gate.
- Test tab `runClient` shows elapsed time, cancel, and logs. The EULA checkbox is unchanged and never silent.

## What was tested

Automated:

- Fabric visible render-state cube (1.21.4 / 1.21.8), multi-screen + `insertItem`, spawn init, permission-level commands
- NeoForge / Forge client renderers, multi-menu transfer, biome-modifier JSON, command registration
- Paper / Spigot pagination overflow, tab-complete, permission nodes, spawn-gap doc
- Existing Phase 1–6 suites

Manual / agent:

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`
- Live `./gradlew build` proof is recorded below when the environment can run it
- Packaging is attempted with `npm run dist:win` or `dist:win:portable` when feasible
- This cloud environment still cannot finish a Minecraft client. No Tested badge was written from compile-only

## Known limitations

- Forge codegen is 1.21.1 only
- Spigot 1.21.8 is unsupported
- Plugin mobs are disguises, not new client types
- GUI layouts are previews; transfer rules are a safe subset, not a full sync framework
- Spawn tables are an allowlisted biome MVP — not ores, dimensions, or structures
- Compatibility stays Experimental until a desktop Minecraft runtime is recorded as evidence

## Security

- Repair and texture paths stay on allowlisted prefixes
- Gradle args remain `build` or `runClient` plus `--no-daemon --stacktrace`
- EULA is never silent-accepted
- Evidence recording still refuses compile-only builds
- Windows packages from this repo are unsigned

## Recommended Phase 8

1. Record one Tested row on a desktop where `runClient` or a real Paper/Spigot server actually finishes.
2. 1.21.11+ / 26.x mapping updates when official templates settle.
3. Full worldgen (ores, configured features, dimensions) still after the spawn MVP.
4. Behavior trees beyond the five movement presets.
5. Signed Windows/macOS installers and auto-update — only with real certificates.
6. Richer menu sync (data slots, ghost recipes) after the transfer-safety subset.

## Live notes

Compile-only remains `true`. No `craftstudio.runtime-evidence.json` was written from this phase.
