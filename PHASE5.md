# Phase 5 report

Phase 5 keeps the Phase 1–4 Electron app and adds Forge + widened NeoForge, a careful Spigot emitter, the first real mob and GUI slices, richer item models, and recoverable snapshots. Model output stays untrusted. Compile success is still not Tested.

## What works

### Loaders
- NeoForge Experimental mappings: **1.21.1** (21.1.250, entities + items), **1.21.4** (21.4.157, items/GUIs only), **1.21.8** (21.8.54, items/GUIs only). Not a Forge claim.
- Forge vertical slice for **1.21.1** (Forge 52.1.16, ForgeGradle 6.0.36, official mappings): trusted Gradle from `craftstudio.spec.json`, `DeferredRegister` items, preset entity registration, `./gradlew build` when JDK 21 is available. `mods.toml` uses `mandatory=true`.
- Spigot emitter for the Paper-supported 1.21 / 1.21.1 / 1.21.4 set using `org.spigotmc:spigot-api` only. Tests fail if Paper-only markers (`io.papermc`, `net.kyori`, `Component.text`, `CustomModelDataComponent`) leak into Spigot output. **1.21.8 is unsupported** on Spigot.
- Capability reporting and version pins reject unsupported combinations honestly.

### Custom mobs (first slice)
- Spec: id, display name, health, a few attributes, three presets (`passive_wanderer`, `hostile_melee`, `neutral_flee`), targeting, spawn stub, drops, appearance/model refs.
- Fabric: entity registration + attributes on all pinned 1.21.x versions. No client renderer is emitted — vanilla model classes are typed to vanilla entities and fail compile against a custom type. `ENTITY_RENDERING.md` documents that limit.
- NeoForge 1.21.1 and Forge 1.21.1: real entity classes + attribute registration. Later NeoForge pins write `MOBS.md`.
- Paper / Spigot: vanilla disguises (zombie / pig / wolf) with name, health, and PDC. UI states that plugins cannot add a new client entity type.

### GUI designers (first slice)
- Mod GUI: screens with labels, buttons, slots, and a labeled **preview**. Fabric emits `ExampleScreenHandler` + `ExampleScreen` with comments that client clicks are untrusted and the server must validate slots. NeoForge / Forge stub with a clear message.
- Plugin GUI: inventory menus, slot placement, icons/text, click actions + permissions, pagination stub, cancelled click/drag. Paper uses Adventure; Spigot uses legacy `setDisplayName`.

### Items, packs, snapshots
- Item models: `generated` or `handheld`, optional `layer1`.
- Exported resource packs include `pack.png` (a CraftStudio mark, not an AI drawing).
- Texture editor + pack export still work. Forge and Spigot packs are now exported too.
- Snapshots: `before-apply` and `before-version-change`. Restore copies files back. Oldest extras are pruned (keep 8).
- Version change runs `assessVersionChange` and blocks incompatible targets (Forge ≠ 1.21.1, Spigot 1.21.8, missing emitter).

## What was tested

Automated:

- Forge emitter goldens (ForgeGradle pin, `mandatory=true`, no NeoForge claim, handheld model, hostile preset entity)
- Spigot emitter + Paper-API leak scan
- NeoForge 1.21.4 / 1.21.8 pins; entities only on 1.21.1
- Mob / plugin-GUI spec validation, handheld+layer1 models, migration assessment
- Snapshot restore + apply / version-change snapshots
- Resource-pack `pack.png`, handheld / layer1, Forge + Spigot export
- Existing Phase 1–4 suites, including generation apply for Fabric / Paper / NeoForge / Forge

Manual / agent:

- `npm test` (94), `npm run lint`, `npm run typecheck`, `npm run build`
- Live `./gradlew build` for Forge 1.21.1, NeoForge 1.21.4, Spigot 1.21.1, and Fabric 1.21.1 (item + preset mob + preview screen) — see “Live notes”
- This cloud environment still cannot finish a Minecraft client. No Tested badge was written from compile-only

## Known limitations

- NeoForge entity registration is 1.21.1 only
- Forge codegen is 1.21.1 only
- Spigot 1.21.8 is unsupported
- Plugin mobs are disguises, not new client types
- GUI layouts are previews; no advanced sync framework
- Fabric entity renderers are not emitted on any pin (vanilla model classes will not compile against a custom type)
- Compatibility stays Experimental until a desktop Minecraft runtime is recorded as evidence

## Security

- Snapshot, pack, and generated paths stay on allowlisted prefixes
- Gradle args remain `build` or `runClient` plus `--no-daemon --stacktrace`
- EULA is never silent-accepted
- Evidence recording still refuses compile-only builds

## Files changed (high level)

| Area | Paths |
| --- | --- |
| Pins / migration | `src/shared/platformPins.ts`, `src/shared/migration.ts` |
| Spec | `src/shared/spec.ts`, `src/shared/defaults.ts`, `src/shared/itemModels.ts` |
| Emitters | `src/main/codegen/{plan,forge,spigot,fabric,neoforge,paper,pack}/**` |
| Snapshots | `src/main/services/snapshotService.ts` |
| UI | Design editors for items / mobs / mod GUIs / plugin GUIs |
| Tests | `tests/forgeEmitter`, `spigotEmitter`, `phase5Spec`, `snapshotService` |

## Live notes

Recorded in this cloud environment after apply + `./gradlew build --no-daemon --stacktrace`. Compile-only remains `true`. No `craftstudio.runtime-evidence.json` was written.

| Project | Result |
| --- | --- |
| Forge 1.21.1 item at `/tmp/cs-phase5-projects/glow-shard-forge-54c5d71d` | **BUILD SUCCESSFUL** in 1m 11s. Jar `glow_shard_forge-1.0.0.jar`. Expanded `mods.toml` contains `glow_shard`. |
| NeoForge 1.21.4 item at `/tmp/cs-phase5-projects/glow-shard-neo-214-fcf01843` | **BUILD SUCCESSFUL** in 1m 54s. Jar `glow_shard_neo_214-1.0.0.jar`. |
| Spigot 1.21.1 item + disguise mob + inventory menu at `/tmp/cs-phase5-projects/harbor-tokens-spigot-51d08e83` | First compile failed (JetBrains `@NotNull` + `return` in a switch expression). After the template fix, **BUILD SUCCESSFUL** in 5s. Jar `harbor_tokens_spigot-1.0.0.jar`. |
| Fabric 1.21.1 item + preset mob + preview screen at `/tmp/cs-phase5-projects/river-stones-fabric-82cd5d2f` | First compile failed (vanilla-typed `ZombieEntityModel` + `FeatureFlags.VANILLA`). After the template fix, **BUILD SUCCESSFUL** in 8s. |

This environment did **not** complete a Minecraft client or a user-launched Paper/Spigot server. Compatibility stays Experimental.

## Recommended Phase 6

1. Record one Tested row on a desktop where `runClient` or a real Paper/Spigot server actually finishes.
2. NeoForge entity registration for 1.21.4 / 1.21.8 after those mappings are proven with a live compile.
3. Fabric 1.21.2+ entity render-state renderers, or an honest “invisible until renderer exists” client warning in-game docs.
4. More than three mob presets still without a full behavior tree.
5. A real Forge/NeoForge container/menu pair (not a stub) with server-side slot validation.
6. Dedicated layer1 texture painting in the Assets editor.
7. 1.21.11+ / 26.x mapping updates when official templates settle.
