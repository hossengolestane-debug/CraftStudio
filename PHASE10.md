# Phase 10 report

Phase 10 keeps Phases 1–9 and adds richer blocks, one more worldgen kind, goal priorities/selectors, a JSON mod config, datapack export, and 1.0-oriented docs. Model output stays untrusted. Compile success is still not Tested. Packages stay unsigned unless a real certificate exists (none in this environment).

## What shipped

- **Pillar / axis blocks** — `shape: pillar` emits Yarn `PillarBlock` / Mojang `RotatedPillarBlock` plus axis blockstates (`x`/`y`/`z`) and a cube-column model.
- **Slab + stairs** — trusted variants from a parent cube-all or pillar: `${id}_slab` / `${id}_stairs`, models, blockstates, loot, lang, creative tab. Cap still 4 parent blocks; derived ids must not collide.
- **Spring worldgen** — `minecraft:spring_feature` for water or lava on stone-family rocks. Fabric step `FLUID_SPRINGS`; Forge/NeoForge `fluid_springs`. Not a lake, geode, or dimension.
- **Goal priorities + targeting** — each goal is `string` (index+1 priority) or `{id, priority 0–9}`. Targeting adds `both`. `followRange` (4–64, default 16) wires to FOLLOW_RANGE / look-at distance. Cap remains 5. Not a behavior tree.
- **Mod config** — `CraftStudioConfig` reads/writes `config/<modid>.json` (Gson). Toggles: `enableWorldgen`, `enableChestLoot`, `spawnWeightScale` (0.25–4). Fabric gates worldgen/loot/spawn scale at runtime. Forge/NeoForge gate chest inject at runtime; biome modifiers are omitted when worldgen is off at Apply; spawn scale is baked into add_spawns JSON.
- **Datapack ZIP** — loot + configured/placed feature JSON + `pack.mcmeta` + `DATAPACK.md`. No Java, no GLM, no biome modifiers. Honest limits.
- **Evidence summary** — Test tab can export a markdown list of recorded runtime evidence. Empty file stays Experimental. Compile-only never appears as Tested.
- **Docs** — README Quick start, [SMOKE.md](SMOKE.md) platforms/features matrix.

Inventory BlockEntities and custom dimensions were not shipped. Pillar + slab/stairs cover two of the three richer-block options. Spring was chosen over a fake dimension stub.

## Honesty

- Plugin custom blocks remain **unsupported**. They are not equal to mod blocks.
- Inventory-capable containers are **not** emitted.
- `spring` is not a custom dimension or structure stack.
- Goal lists stay a hard cap. Priorities do not add new goal kinds.
- Datapack export is not a substitute for the Java mod’s biome injection or GLM chest inject.
- Compile-only Gradle never writes `craftstudio.runtime-evidence.json` and never flips **Tested**.
- Packages remain unsigned without a real certificate. Forge is not NeoForge. Paper is not Spigot.

## Pins (unchanged)

| Adapter | Emitted pins |
| --- | --- |
| Fabric | 1.21, 1.21.1 (classic `Registry.register`), 1.21.2 / 1.21.4 / 1.21.8 (`Items.register` + `RegistryKey`) |
| Forge | 1.21.1 only (Forge 52.1.16, ForgeGradle 6.0.36) |
| NeoForge | 1.21.1 / 1.21.4 / 1.21.8 |
| Paper / Spigot | same 1.21.x pins as Phase 8; blocks and worldgen rejected |

## Version

App version is **0.10.0** until a live `./gradlew build` for the Phase 10 slice (pillar + slab/stairs + spring + config + priorities) is recorded below. Then it may become **1.0.0**. Tested stays evidence-gated either way.

## Post-1.0 recommendations

1. Record at least one Tested row on a desktop where `runClient` or a real Paper/Spigot server actually finishes.
2. A tiny inventory BlockEntity (9–27 slots) only if each pin’s menu + BE API stays compiling.
3. Multipart blockstates beyond axis/slab/stairs, or a horizontal-facing block, if goldens stay small.
4. One more official configured-feature (geode-lite or lake) — still not a dimension stack.
5. Optional ForgeConfigSpec / Cloth Config UI; keep the JSON file as the common path.
6. Datapack biome JSON that actually places exported features, labeled Experimental.
7. Signed Windows/macOS installers and auto-update — only with real certificates.
8. 1.21.11+ / 26.x mapping updates when official templates settle.

## Live notes

Compile-only remains `true`. No `craftstudio.runtime-evidence.json` is written from compile-only. This section is filled after a real `./gradlew build`.
