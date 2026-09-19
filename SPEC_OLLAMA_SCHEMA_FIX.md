# 1.0.3 Ollama JSON Schema ↔ Zod fix

Do **not** merge this as a feature drop. This is a hotfix for invalid Legendary Mace-style specs. Phases 1–10 and the 1.0.1/1.0.2 Live Activity work stay in place.

## Root cause

Zod (`projectSpecSchema` / `itemAttributeSchema` / shaped recipe rules / command objects / unsupportedRequest objects) was already the runtime source of truth. The object sent to Ollama as `format` was a **stub**:

- `attributes: { type: 'array' }` with no `items`
- `recipes`, `commands`, `unsupportedRequests`, `blocks`, `mobs` were bare `{ type: 'array' }`

Live Activity `settings.format: 'json-schema'` was a **label only**. The real `/api/chat` body used `format: OLLAMA_SPEC_JSON_SCHEMA`, but that object was incomplete, so the label did not prove a correct schema was sent.

`SYSTEM_PROMPT` contradicted Zod (`commands: names only`; no attribute enum; no shaped pattern rules). Repair used `format: 'json'` without the schema. Attribute helpers (`yarnAttributeName` / `mojangAttributeName`) convert **from** internal ids, so Minecraft `generic.attackDamage` / `generic.attack_damage` failed `z.enum(ITEM_ATTRIBUTES)`.

Observed Zod failures from Ollama output:

| Failure | Zod |
| --- | --- |
| attributes require `id` and `amount` | `itemAttributeSchema` |
| Attribute IDs must be `attack_damage` / `attack_speed` / `armor` / `max_health` / `movement_speed` | `z.enum(ITEM_ATTRIBUTES)` |
| Recipes require `resultItemId` | `recipeSchema` |
| Shaped `pattern` rows fail `/^[ A-Z#.]{1,3}$/` | lowercase / long / human rows |
| `commands` must be `{ name }` objects | `commandSchema` |
| `unsupportedRequests` must be `{ feature, reason }` | `unsupportedSchema` |

## Changes

1. **One authoritative spec.** `OLLAMA_SPEC_JSON_SCHEMA` is built from the same constants Zod uses (`ITEM_ATTRIBUTES`, recipe pattern regex, command/unsupported object `required`, nested `items`). Zod remains the runtime validator in `parseProjectSpec`.
2. **Wire payload.** Tests inspect the actual `/api/chat` JSON `format` object (`properties.items.items.properties.attributes.items`, recipe `required`, pattern regex, command/unsupported `required`). Activity still shows a human label (`craftstudio-spec-json-schema`); that label is not proof.
3. **Prompt.** `SPEC_SYSTEM_PROMPT` matches the schema, includes CraftStudio attribute enums (never `generic.*` / `GENERIC_*` in JSON), a minimal valid example fixture, command objects, and honesty that schema-valid ≠ implemented.
4. **Shaped recipes.** Deterministic normalize: uppercase A–Z, pad row widths, `result`/`key` object → `resultItemId` + `keys[]`. Off-allowlist ingredients (e.g. `minecraft:breeze_rod`) are **not** swapped; they are recorded in `unsupportedRequests` and still fail Zod.
5. **Repairs.** Repair calls pass `format: OLLAMA_SPEC_JSON_SCHEMA` (full), previous JSON, field-level Zod errors, and `SPEC_REPAIR_CONSTRAINTS`.
6. **Aliases only.** `normalizeAttributeId` maps documented Minecraft/Yarn names (`generic.attackDamage`, `generic.attack_damage`, `GENERIC_ATTACK_DAMAGE`, …) to internal enums. No invented gameplay attributes.
7. **Legendary Mace honesty.** Prompt/template patterns record mace smash / Density / Breach, life steal, shockwaves / terrain, enchantments, and AI textures in `unsupportedRequests`. Template fallback is not reported as a completed Legendary Mace.
8. **Timeout ≠ cancel.** `GENERATION_TIMEOUT` is a distinct error/activity status. Manual cancel stays `GENERATION_CANCELLED`. Model-test wait is bounded at 45s for first load of `qwen2.5-coder:7b` — not raised for 14b/26b.

## Validation results (cloud VM, 2026-09-18)

| Check | Result |
| --- | --- |
| Unit: raw Legendary Mace fixture fails Zod on the listed paths | Run with `npm test` (this revision) |
| Unit: normalize maps aliases / objects / pattern rows; breeze_rod not swapped | Run with `npm test` |
| Unit: JSON Schema expresses user-hit failure modes; cross-field rules documented | Run with `npm test` |
| Unit: `/api/chat` body `format` is the complete object, not `'json-schema'` | Run with `npm test` |
| Unit: timeout vs cancel error codes | Run with `npm test` |
| Forge emitter golden for corrected Legendary Mace spec | Run with `npm test` (item + attributes + shaped recipe + stub command; no smash/lifesteal/shockwave Java) |
| `npm test` / lint / typecheck / `electron-vite build` | **PASS** — 146 tests, eslint clean, `tsc` both projects, `electron-vite build` wrote `out/` and `out/build-info.json` (1.0.3) |
| Live Ollama (`qwen2.5-coder:7b`) | **NOT RUN** — this cloud VM has no Ollama / GPU |
| Minecraft client / `runClient` | **NOT RUN** |

Full model transcripts are written only when Settings → persist full AI logs is on (`persistFullAiLogs`). Default remains redacted/truncated Activity previews.

## Packaged build / Windows install

Version is **1.0.3**. Settings → About must show 1.0.3 after you launch the **new** exe.

1. On Windows, rebuild from this branch (`npm run dist:win:portable` or your usual unpacked dir target).
2. Copy the new portable / unpacked tree into **`E:\CraftStudio Local 1.0.3\`**. Keep `E:\CraftStudio Local\`, `E:\CraftStudio Local 1.0.1\`, and any other older folders. Do **not** delete project folders.
3. Quit every running CraftStudio window. Launch `E:\CraftStudio Local 1.0.3\CraftStudio Local.exe` (or the unpacked exe in that folder).
4. Confirm Settings → About: version **1.0.3**, and the running executable path is inside `E:\CraftStudio Local 1.0.3\`.
5. Confirm Settings still points at the existing CraftStudioProjects directory (Legendary Mace and other projects live there, not inside the exe).

## Live Ollama on Windows (NOT RUN here)

Prefer **`qwen2.5-coder:7b`**. Do not pull 14b/26b/25GB models for this check.

```bat
ollama pull qwen2.5-coder:7b
ollama list
```

In CraftStudio Local 1.0.3:

1. Settings → endpoint `http://localhost:11434` → Check connection (`/api/tags` only).
2. Select `qwen2.5-coder:7b`. Test model (bounded 45s). A timeout message is **not** a cancel; Cancel inference is the cancel path.
3. Optional: enable persist full AI logs if you want the complete `/api/chat` transcript locally.
4. Open the Legendary Mace project (or a copy). Design → Ask local Ollama with the original mace prompt.
5. Confirm Activity settings show the schema label, but the **validated spec** uses `attack_damage` (not `generic.*`), `resultItemId`, object commands, object `unsupportedRequests`, and shaped pattern rows of 1–3 `[ A-Z#.]`.
6. Confirm `unsupportedRequests` still lists mace smash / life steal / shockwaves / enchantments. Schema-valid is not implemented.

## What this does not do

- Does not implement 1.21 mace smash, Density, Breach, life steal, shockwaves, terrain edits, custom enchantments, or AI-drawn textures.
- Does not silently replace `breeze_rod` / netherite with iron.
- Does not raise generation waits for huge models.
- Does not merge to `main`.
