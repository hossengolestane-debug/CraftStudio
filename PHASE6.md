# Phase 6 report

Phase 6 keeps the Phase 1–5 Electron app and adds deeper entities, real Forge/NeoForge menus, dedicated layer1 painting, and bounded build diagnostics. Model output stays untrusted. Compile success is still not Tested.

## What works

### Entity / mob depth
- NeoForge preset entity registration on **1.21.1** (legacy `EntityType.Builder.build(String)`), **1.21.4**, and **1.21.8** (`ResourceKey` build). Still **not** a Forge claim.
- Five presets: `passive_wanderer`, `hostile_melee`, `neutral_flee`, `avoid_players`, `stationary_lookout`. Not a behavior tree.
- Fabric 1.21 / 1.21.1: compiling custom cube model + `MobEntityRenderer` (vanilla-typed models are still not used).
- Fabric 1.21.2+: compiling render-state `EntityRenderer` that draws nothing, plus a client join warning and `ENTITY_RENDERING.md`.
- Paper / Spigot: vanilla disguises only. UI still says plugins cannot add a new client entity type.

### Real mod menus
- Forge 1.21.1 and NeoForge 1.21.x emit `ExampleMenu` + `ExampleScreen` + `ClientScreens` from the existing mod GUI designer.
- Server-side `mayPlace` + refused `quickMoveStack`. `/opencustommenu` opens the preview.
- Fabric HandledScreen / ScreenHandler path is unchanged and still uses `FeatureFlags.VANILLA_FEATURES`.

### Assets
- Dedicated layer1 painting in Assets (`craftstudio/textures/<id>_layer1.png`).
- Pack export includes layer1 when the item flag is on and the overlay PNG exists (falls back to layer0).

### Diagnostics & repair
- Gradle results include mapped diagnostics (JDK missing, offline/cache, FeatureFlags, JetBrains `@NotNull`, switch `yield`, Forge context).
- **Try known template repair** rewrites allowlisted `src/main/java/**/*.java` only. It never mutates `build.gradle` and never runs model shell.
- Remaining problems stay visible when repair cannot apply.

### Install UX
- INSTALL.md / Export notes cover jar destination, resource packs, `/opencustommenu`, and summon ids.
- Create wizard Build / Export buttons call the same Java, Gradle, and export services. A project without an applied spec fails honestly.

## What was tested

Automated:

- NeoForge entities + menus on 1.21.1 / 1.21.4 / 1.21.8
- Forge container menu goldens + extra presets
- Fabric cube renderer (classic) and render-state stub (1.21.4)
- Diagnostics mapping + bounded FeatureFlags repair
- layer1 texture path + pack overlay key
- Existing Phase 1–5 suites

Manual / agent:

- `npm test` (99), `npm run lint`, `npm run typecheck`, `npm run build`
- Live `./gradlew build` for NeoForge 1.21.4 + 1.21.8 (entity + menu), Forge 1.21.1 (entity + menu), and Fabric 1.21.1 (cube renderer + menu) — see “Live notes”
- This cloud environment still cannot finish a Minecraft client. No Tested badge was written from compile-only

## Known limitations

- Forge codegen is 1.21.1 only
- Spigot 1.21.8 is unsupported
- Plugin mobs are disguises, not new client types
- Fabric 1.21.2+ entities are invisible (compiling stub + warning)
- GUI layouts are previews; no advanced sync framework
- Repair covers only known template mismatches
- Compatibility stays Experimental until a desktop Minecraft runtime is recorded as evidence

## Security

- Repair and texture paths stay on allowlisted prefixes
- Gradle args remain `build` or `runClient` plus `--no-daemon --stacktrace`
- EULA is never silent-accepted
- Evidence recording still refuses compile-only builds

## Files changed (high level)

| Area | Paths |
| --- | --- |
| Pins / presets | `src/shared/platformPins.ts`, `src/shared/spec.ts`, `src/shared/buildDiagnostics.ts` |
| Emitters | `src/main/codegen/{fabric,forge,neoforge,modgui,mobs}/**` |
| Repair / textures | `src/main/services/{repairService,textureService,gradleService}.ts` |
| UI | Texture layer picker, Test diagnostics, wizard Build/Export |
| Tests | `tests/phase6Diagnostics`, emitter goldens |

## Live notes

Recorded in this cloud environment after apply + `./gradlew build --no-daemon --stacktrace`. Compile-only remains `true`. No `craftstudio.runtime-evidence.json` was written.

| Project | Result |
| --- | --- |
| NeoForge 1.21.4 item + `avoid_players` mob + preview menu at `/tmp/cs-phase6-projects/glow-mite-neo214` | First compile failed (`FeatureFlags.VANILLA` is a FeatureFlag on this pin). After switching to `IMenuTypeExtension.create`, **BUILD SUCCESSFUL** in 5s. |
| NeoForge 1.21.8 same slice at `/tmp/cs-phase6-projects/glow-mite-neo218` | First compile failed (`EventBusSubscriber.bus` removed). After omitting `bus=`, **BUILD SUCCESSFUL** in 6s. |
| Forge 1.21.1 item + mob + menu at `/tmp/cs-phase6-projects/glow-mite-forge` | **BUILD SUCCESSFUL** in 9s. |
| Fabric 1.21.1 item + cube renderer + preview screen at `/tmp/cs-phase6-projects/glow-mite-fabric` | **BUILD SUCCESSFUL** in 22s. |

This environment did **not** complete a Minecraft client. Compatibility stays Experimental.

## Recommended Phase 7

1. Record one Tested row on a desktop where `runClient` or a real Paper/Spigot server actually finishes.
2. A visible Fabric 1.21.2+ render-state model (not an invisible stub) after a live client check.
3. NeoForge/Forge entity renderers (client) so summoned mobs are visible in runClient.
4. More than one container screen per spec, with real item transfer validation.
5. 1.21.11+ / 26.x mapping updates when official templates settle.
6. Dedicated biome spawn tables still without a full worldgen stack.
