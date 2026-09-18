# Phase 4 report

Phase 4 keeps the Phase 1–3 Electron app and adds resource packs, a real pixel texture editor, a NeoForge 1.21.1 Gradle slice, and evidence-gated **Tested** status. Model output stays untrusted. Compile success is still not Tested.

## What works

- Pixel texture editor (Assets): PNG import/export, pencil, eraser, fill, palette, grid, zoom, undo/redo, transparency, 16×16 and 32×32 presets
- Textures write to `craftstudio/textures/<item_id>.png` (path-confined + allowlisted). Optional `.pixels.json` next to the PNG
- Ollama may suggest a hex palette or pixel-spec JSON only. The app never claims the model drew a raster image
- Resource-pack export:
  - Fabric / NeoForge: `pack.mcmeta` + `assets/<modid>/textures/item/` + `models/item/`
  - Paper: CustomModelData (predicate overrides on 1.21 / 1.21.1; `range_dispatch` on 1.21.4 / 1.21.8). UI states that **every client must install the pack**
- Applying a spec copies existing painted textures into Fabric/NeoForge `src/main/resources/assets/…` and updates item models off the flint placeholder
- NeoForge vertical slice for **1.21.1** (NeoForge 21.1.250, ModDevGradle 2.0.147): trusted Gradle, `DeferredRegister.Items`, `META-INF/neoforge.mods.toml`, `./gradlew build` / optional `runClient`
- **Not Forge.** Forge and Spigot remain stubs with clear messaging. Paper success is still not Spigot
- Test tab separates compile vs runtime. Compatibility may flip to Tested only when a runtime evidence record exists (timestamp, platform, version, what was verified)
- Evidence is refused for compile-only Gradle builds, missing EULA, failed `runClient`, or Paper without user attestation of a server they launched
- Monaco on the Code tab, bound to the existing tree, with save + preserve-user-edits / diff on regenerate

## What was tested

Automated:

- Resource-pack path safety and Fabric/Paper pack goldens (`pack_format`, CMD predicate vs range_dispatch)
- Texture undo stack, flood fill, PNG encode/decode round-trip, pixel-spec rasterize
- NeoForge emitter goldens (ModDevGradle pin, DeferredRegister, no Forge claim)
- Tested-evidence gating (static registry stays Experimental; overlay requires a valid record)
- Existing Phase 1–3 suites, plus NeoForge apply in the generation pipeline

Manual / agent:

- `npm test` (80), `npm run lint`, `npm run typecheck`, `npm run build`
- Live NeoForge 1.21.1 apply at `/tmp/cs-phase4-projects/glow-shard-neoforge` then **`./gradlew build` → BUILD SUCCESSFUL** in 1m 33s (`compileJava` + `jar`). The built `neoforge.mods.toml` expanded to `modId="glow_shard"`. Compile-only remains `true`
- Live resource pack ZIP at `/tmp/cs-phase4-projects/glow-shard-resource-pack.zip` contains `pack.mcmeta`, `assets/glow_shard/models/item/glow_shard.json`, and a real PNG
- This cloud environment did **not** complete a Minecraft client or Paper server. No `craftstudio.runtime-evidence.json` was written. Compatibility stays Experimental

## Known limitations

- NeoForge codegen is 1.21.1 only (one Experimental mapping)
- Forge and Spigot stay stubs
- Paper still cannot register a new client item id
- Ollama does not generate raster textures
- `runClient` / user Paper servers are the only paths to Tested; this VM typically cannot finish a client
- No mob/GUI designers

## Security

- Texture and pack writes stay on allowlisted prefixes (`craftstudio/textures/`, `resource-pack/`, `src/main/…`)
- Gradle args remain `build` or `runClient` plus `--no-daemon --stacktrace`
- EULA is never silent-accepted. Game files are never distributed
- Evidence recording re-checks last Gradle result and settings; the renderer cannot mark Tested by itself

## Files changed (high level)

| Area | Paths |
| --- | --- |
| Pins / evidence | `src/shared/platformPins.ts`, `src/shared/evidence.ts`, `src/shared/compatibility.ts` |
| Textures | `src/shared/png.ts`, `src/shared/pixelSpec.ts`, `src/shared/textureCanvas.ts`, `src/main/services/textureService.ts` |
| Packs | `src/main/codegen/pack/planner.ts`, Export tab |
| NeoForge | `src/main/codegen/neoforge/emitter.ts` |
| Tested | `src/main/services/evidenceService.ts`, Test tab |
| Code | Monaco on `CodeTreeView` |
| Tests | `resourcePack`, `textureEditor`, `neoforgeEmitter`, `evidence` |

## Recommended Phase 5

1. Record one Tested row on a desktop where `runClient` or a real Paper server actually finishes.
2. Additional NeoForge 1.21.x mappings (still without claiming Forge).
3. Optional dedicated Spigot emitter if dual-API work is justified — do not copy Paper blindly.
4. Richer item models (handheld, layer1) and pack.png.
5. 1.21.11+ / 26.x mapping updates when the official templates settle.
