# Phase 2 report

Phase 2 adds a real generation vertical slice on top of the Phase 1 Electron app. Users describe features, get a **Zod-validated** project spec, and (for Fabric 1.21 / 1.21.1) apply a **trusted-template** Gradle project. Ollama is optional and untrusted.

## What works

- Typed `craftstudio.spec.json` (schemaVersion 1): items, shapeless recipes, command stubs, unsupported-request notes
- Template inference for common “add an item / recipe” prompts — **works with Ollama down**
- Optional local Ollama `/api/chat` with JSON format, streaming progress, cancel, timeout, `num_ctx` / `num_predict`
- Independent Zod validation; at most 3 repair attempts; leftover problems are shown; model “I succeeded” is never treated as success
- Fabric emitter: `build.gradle`, `settings.gradle`, `gradle.properties`, vendored Gradle wrapper, `fabric.mod.json`, `ModInitializer`, lang, placeholder item model, shapeless recipe JSON
- Path confinement for every generated relative path (project folder + projects root)
- Build scripts only from allowlisted templates; overwrite diffs in the UI
- Design → generate → review → apply; Code tree + file viewer; Test tab runs real `./gradlew build` for Fabric only
- Settings: default model, generation timeout, context/predict limits, repair budget

## What was tested

Automated:

- Spec schema (valid, traversal-like packages, bad ids, recipe allowlist, fenced JSON, template infer, unsupported notes)
- Generated path safety (nested src, `..`, absolute, sibling escape, allowlist)
- Fabric emitter golden-ish: pinned Loom/Yarn, item Java, recipe JSON, wrapper jar, rejects Paper / 1.18.2
- Ollama garbage: path-like `modId` rejected; prose “success” is not a spec
- Existing Phase 1 suites still pass

Manual / agent (this environment):

- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`
- Template generate + apply against a temp / live Fabric 1.21.1 project (see verification notes in the PR)
- `java -version` is 21.0.10 here
- Generated `/tmp/cs-live-projects/live-pebble-f95e34e0` (template spec → apply) then **`./gradlew build` succeeded** (Loom 1.9.2, 54s, `BUILD SUCCESSFUL`, `compileJava` + `remapJar`). Network was available to fetch Gradle 8.11.1 and Minecraft/Yarn artifacts.

## Known limitations

- Codegen target is **Fabric + Minecraft 1.21 or 1.21.1 only**
- Commands are recorded, not registered
- Placeholder item texture (`minecraft:item/flint`) — no painter
- No mixins, no split client source set, no `runClient`
- Official example-mod has moved toward `fabric-loom-remap` + Mojang mappings; this slice uses **classic `fabric-loom` + Yarn** so wiki item registration compiles
- Gradle wrapper JAR is vendored from Fabric example-mod; distribution URL is pinned to Gradle 8.11.1
- Other platforms remain stubs

## Security

- Model output is spec JSON only. Java/Gradle are never model-authored.
- No `child_process` of model strings. Gradle args are a fixed allowlist.
- `resolveProjectFile` + output allowlist reject traversal and surprise paths (`evil.sh` is not writable).

## Files changed (high level)

| Area | Paths |
| --- | --- |
| Spec | `src/shared/spec.ts`, `templateInfer.ts` |
| Codegen | `src/main/codegen/fabric/*`, `allowlist.ts`, vendored `wrapper/` |
| Services | `generationService.ts`, `filePlan.ts`, `javaService.ts`, `gradleService.ts`, Ollama chat |
| UI | `DesignGenerate.tsx`, `CodeTreeView.tsx`, `TestBuildView.tsx`, Settings |
| Tests | `tests/spec.test.ts`, `generatedPath.test.ts`, `fabricEmitter.test.ts`, `ollamaSpec.test.ts` |

## Recommended Phase 3

1. Run `./gradlew runClient` (or a Paper server) and only then mark a compatibility row **Tested**.
2. Add 1.21.2+ item registration (`Items.register` + `RegistryKey`) so 1.21.4 / 1.21.8 can emit.
3. Second adapter (Paper) with the same spec → plugin.yml + Java plugin.
4. Optional Monaco bound to the existing read-only tree.
5. Structured Ollama only for fields templates cannot fill — keep file emission trusted.
