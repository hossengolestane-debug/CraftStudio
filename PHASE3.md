# Phase 3 report

Phase 3 keeps the Phase 1–2 Electron app and widens the vertical slice: more Fabric 1.21.x mappings, a real Paper plugin emitter, export, and a beginner item editor. Model output stays untrusted. Compatibility is still **not Tested**.

## What works

- Fabric codegen for **1.21, 1.21.1, 1.21.2, 1.21.4, 1.21.8**
  - 1.21 / 1.21.1: classic `Registry.register` (Yarn + fabric-loom 1.9.2)
  - 1.21.2+: `Items.register` + `RegistryKey<Item>` (1.21.8 uses Loom 1.10.1)
- Paper codegen for **1.21, 1.21.1, 1.21.4, 1.21.8**: `plugin.yml`, `JavaPlugin`, shapeless recipes, `/givecustomitem`, vanilla paper + PDC
- Same `craftstudio.spec.json` for both adapters
- Structured item editor (name, id, stack size, rarity, shapeless recipe) without Ollama
- Source ZIP export (project-confined walk, skips `.gradle` / `build` / `run`)
- JAR export from `build/libs` after a real successful build
- Test tab: real `./gradlew build` for Fabric and Paper; optional Fabric `runClient` only after explicit EULA acceptance
- Paper `run-paper/eula.txt` is written as `eula=false` with install notes — no server download, no silent accept
- Resource-pack export: honest “not yet”

## What was tested

Automated:

- Fabric golden emit per mapping set (classic vs `Items.register` + `RegistryKey`)
- Paper golden emit (`plugin.yml`, PDC, `eula=false`, rejects Spigot/1.18.2)
- Export path safety (zip skips `build/`, refuses missing jars, traversal still rejected)
- Item editor ↔ spec round-trip (`source: editor`)
- Generation pipeline for Fabric and Paper
- Existing Phase 1–2 suites

Manual / agent:

- `npm test` (63), `npm run lint`, `npm run typecheck`, `npm run build`
- Live Paper 1.21.1 apply at `/tmp/cs-phase3-projects/harbor-tokens-4dccf5f2` then **`./gradlew build` → BUILD SUCCESSFUL** in 12s (`compileJava` + `jar` → `harbor_tokens-1.0.0.jar`)
- Live Fabric 1.21.4 apply at `/tmp/cs-phase3-projects/glow-shard-05b59845` (`Items.register` + `RegistryKey`) then **`./gradlew build` → BUILD SUCCESSFUL** in 45s (`compileJava` + `remapJar`)
- Compile success still does **not** flip Tested — no Minecraft client or Paper server was launched in this environment
- Live Electron UI: created **Harbor Tokens** (Paper 1.21.1), template generate listed `harbor_token`, item editor set stack size to 16 (`source: editor`), Apply wrote `plugin.yml` + `HarborTokens.java`. Folder: `~/.config/craftstudio-local/CraftStudioProjects/harbor-tokens-ab439be3/`

## Known limitations

- No 1.20.x / 1.18.x Fabric or Paper emitters
- Paper items are not new client item ids (vanilla paper + PDC)
- Resource packs, mobs, GUIs, textures, NeoForge/Forge/Spigot codegen: out of scope
- `runClient` / Paper server launch are wired or documented only; this VM may not finish a Minecraft client
- Compatibility registry remains Experimental

## Security

- Model output is spec JSON only
- Writes confined to the project; export walk uses `resolveProjectFile`
- Gradle args: `build` or `runClient` plus `--no-daemon --stacktrace` only
- EULA must be checked by the user; `eula=true` is never written

## Files changed (high level)

| Area | Paths |
| --- | --- |
| Pins | `src/shared/platformPins.ts` |
| Fabric | `src/main/codegen/fabric/emitter.ts` |
| Paper | `src/main/codegen/paper/emitter.ts` |
| Export | `src/main/services/exportService.ts`, `zip.ts` |
| Editor | `src/shared/editorSpec.ts`, `ItemEditor.tsx` |
| UI | Design / Test / Export tabs, Settings EULA |
| Tests | `fabricEmitter`, `paperEmitter`, `exportPath`, `itemEditor` |

## Recommended Phase 4

1. Verify `runClient` or a real Paper server in a desktop environment, then mark **one** compatibility row Tested with evidence.
2. Resource-pack export for Paper CustomModelData / Fabric item textures.
3. NeoForge or a carefully dual-tested Spigot slice (do not copy Paper blindly).
4. Optional Monaco bound to the read-only tree.
5. 1.21.11+ / 26.x mapping updates when Fabric’s remap plugin becomes the documented default.
