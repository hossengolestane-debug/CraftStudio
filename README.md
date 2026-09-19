# CraftStudio Local

Desktop app that helps beginners create **Minecraft Java Edition** mods and server plugins using **local Ollama**.

| Mods | Plugins |
| --- | --- |
| Fabric, NeoForge, Forge | Paper, Spigot |

**Phase 10 / 1.0.7** keeps Phases 1–10 and the 1.0.1–1.0.6 hotfixes, and continues the reusable Forge 1.21.1 weapon-generation workflow. Confirm Settings → About shows **1.0.7**. Install rebuilt Windows binaries into `E:\CraftStudio Local 1.0.7\` (keep older version folders). Legendary Mace is **not** complete and must not be Applied from this change set — review the corrected fixture first. See [FORGE_WEAPON_WORKFLOW.md](FORGE_WEAPON_WORKFLOW.md), [LEGENDARY_MACE_SPEC.json](LEGENDARY_MACE_SPEC.json), [SPEC_INSPECTOR.md](SPEC_INSPECTOR.md), [OLLAMA_HTTP400_SCHEMA_FIX.md](OLLAMA_HTTP400_SCHEMA_FIX.md), [SPEC_OLLAMA_SCHEMA_FIX.md](SPEC_OLLAMA_SCHEMA_FIX.md), [PERF_OLLAMA_LIVE_ACTIVITY.md](PERF_OLLAMA_LIVE_ACTIVITY.md), [SMOKE.md](SMOKE.md), and [PHASE10.md](PHASE10.md).

## Quick start

1. **Create** a project (Fabric 1.21.1 is the shortest path). Pick an exact Minecraft version the adapter emits.
2. **Describe / edit** on Design. Type a prompt or use the editors: items, blocks (cube-all or pillar, optional slab/stairs), mobs (preset or up to 5 goals with priorities), worldgen (ore / surface patch / spring), GUI, and config toggles.
3. **Apply** — Review file changes, then Apply files. A snapshot is written first. Java and Gradle come from trusted templates, never from the model.
4. **Build** — Test → Gradle build. Exit 0 is compile-only. It does not mark Tested.
5. **Export** — source ZIP anytime; built JAR after a real compile; resource pack after painting textures; optional datapack ZIP for loot + worldgen JSON (not the Java mod). Packages stay unsigned unless you have a real certificate.

Then, on a desktop with the game: accept the Minecraft EULA on Test, run `runClient` (or launch your own Paper/Spigot server), write what you verified, and record evidence. Only that flips a compatibility row to Tested.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- JDK 21 on PATH to run `./gradlew build` (generation still works without it)
- Windows, macOS, or Linux (docs are Windows-first; the code is portable)

Optional: [Ollama](https://ollama.com) at `http://localhost:11434` for requests templates cannot express. Simple items, preset mobs, and simple GUIs generate **without** Ollama. Ollama may also suggest a texture palette — it does not draw PNGs.

## How to run

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
npm test
npm run lint
npm run typecheck
npm run dist:win
npm run dist:linux
npm run dist:mac
```

Packaging is **unsigned**. `dist:linux` builds a directory + AppImage on Linux x64. `dist:mac` is a directory target and typically fails on Linux (no macOS SDK / notarization). `dist:win` may only produce an unpacked/`portable` artifact on Linux (NSIS often needs Wine). See [PHASE10.md](PHASE10.md).

On some Linux containers:

```bash
CRAFTSTUDIO_NO_SANDBOX=1 npm run dev
```

## Vertical slice (Phase 10)

1. Create **Fabric** 1.21.x, **Paper** 1.21.x, **NeoForge** 1.21.1 / 1.21.4 / 1.21.8, **Forge 1.21.1**, or **Spigot** 1.21 / 1.21.1 / 1.21.4.
2. Open **Design**. Edit items, **blocks** (cube-all or pillar; optional slab/stairs), recipes, a mob (preset shortcut or up to 5 allowlisted goals with priorities and players/hostiles/both targeting), ore veins / surface patches / springs, config toggles, and a GUI. Generate a spec (templates first). Undo keeps a 20-step history.
3. **Review file changes**, then **Apply files**. A snapshot is written first.
4. Change Minecraft version only after **Assess change** lists incompatible features. Adding blocks on a plugin pin is blocked. A snapshot is written first.
5. Open **Assets**. Paint item layer0 / layer1 or a **block** texture (reused by pillar/slab/stairs).
6. Open **Export** for a source ZIP, a built JAR after `./gradlew build`, a resource pack, or a **datapack ZIP** (loot + worldgen JSON only).
7. Open **Test** for a real Gradle compile. Export an evidence summary from the same tab. Runtime verification (and Tested) is a separate, evidence-gated step.

Fabric 1.21 / 1.21.1 uses classic `Registry.register` (items + blocks) and loot-api-v2 chest injection. Fabric 1.21.2+ uses `Items.register` + `RegistryKey` (blocks also take `.registryKey`) and loot-api-v3. NeoForge and Forge emit `Block` / `RotatedPillarBlock` / `SlabBlock` / `StairBlock` + `BlockItem`, GLM chest injection, and client entity renderers. NeoForge is **not** Forge. Forge 1.21.1 uses ForgeGradle 6 + `mods.toml` `mandatory=true`. Paper items are vanilla `Material.PAPER` + PDC + CustomModelData. Spigot uses `org.spigotmc:spigot-api` — **Paper APIs are not copied**. Plugin mobs are **vanilla disguises**. Plugins **cannot** register custom blocks or inject vanilla chests. Biome spawn tables, ore veins, surface patches, and springs emit for Fabric / Forge / NeoForge only.

Ollama may only propose spec JSON (or a color palette). That JSON is independently validated. **Nothing is written from unvalidated model text.** Java and Gradle stay template-authored.

## Architecture

```text
src/main/          Electron main (projects, Ollama, generation, Gradle, export, textures, evidence, snapshots, repair, Live Activity bus)
src/main/codegen/  Fabric + Paper + NeoForge + Forge + Spigot templates + vendored Gradle wrapper
src/preload/       Restricted contextBridge
src/renderer/      React UI (item / mob / GUI editors, Monaco, texture editor)
src/shared/        Manifest, Zod spec, adapters, compatibility, pins, PNG, evidence, migration, diagnostics
```

Pinned app stack: Electron 39, electron-vite 5, Vite 7, React 19, TypeScript 5.9, Tailwind 4, Zod 3, Vitest 3, Monaco 0.52.

Fabric pins come from [fabricmc.net/develop](https://fabricmc.net/develop/) / Fabric Meta. Paper pins use official `paper-api` coordinates from repo.papermc.io. NeoForge pins come from [maven.neoforged.net](https://maven.neoforged.net/releases). Forge pins come from [maven.minecraftforge.net](https://maven.minecraftforge.net/). Spigot pins use `hub.spigotmc.org` snapshots.

## Honesty

- NeoForge success is not Forge compatibility
- Paper success is not Spigot compatibility
- Plugin custom mobs are vanilla disguises; they are not new client entity types
- Plugin custom blocks are unsupported; they are not equal to Fabric/Forge/NeoForge blocks
- Inventory-capable BlockEntities are not emitted
- Chest bonus loot is injected on mods into four allowlisted vanilla chests only; plugins do not inject
- A standalone datapack ZIP does not inject biome features or vanilla chests
- Goal lists stay a hard-capped allowlist with priorities — not a behavior tree
- `spring` is `minecraft:spring_feature` only. This is not a custom dimension stack
- GUI designers are labeled **preview**; they are not Minecraft-verified UIs
- Compatibility rows are **not Tested** until a runtime evidence record exists
- `runClient` requires an explicit Minecraft EULA checkbox; CraftStudio never silent-accepts and never distributes game files
- Model output cannot write outside the project or run a shell
- The texture editor does not pretend Ollama painted a PNG
- Build repair only rewrites allowlisted Java for known template mismatches — never model shell, never silent `build.gradle` mutation
- Installers stay unsigned without a real certificate
- Check connection never starts inference; Test model is an explicit short ping
- CraftStudio request limits do not control other programs using Ollama
- Live Activity never invents progress, percentages, or chain-of-thought
- Pause display does not cancel generation or Gradle

See [SMOKE.md](SMOKE.md), [PERF_OLLAMA_LIVE_ACTIVITY.md](PERF_OLLAMA_LIVE_ACTIVITY.md), [PHASE1.md](PHASE1.md)–[PHASE10.md](PHASE10.md).
