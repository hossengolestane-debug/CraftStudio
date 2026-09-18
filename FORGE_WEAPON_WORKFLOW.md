# 1.0.6 Forge 1.21.1 weapon workflow

Legendary Mace is the acceptance case. The implementation is reusable (`items[].weapon` + Forge Java templates). It is not a one-item special case.

Windows packaging target after this lands: **`E:\CraftStudio Local 1.0.6\`**. Keep older version folders. Coordinator packages Windows binaries after this change set. About must show **1.0.6**.

## What 1.0.5 verification actually hit

User verification of 1.0.5 produced a generic item, iron+stick recipe, `legendary_mace_mob`, chest loot, unsupported combat extras, no verified texture, unimplemented effects in the description, a mid-word stored prompt/description cut at `IMPLEMENTATION AND VERIFI`, and `source: "merged"`.

The merge path was investigated **without treating it as the only cause**:

| Symptom | Root cause | Merge involved? |
| --- | --- | --- |
| Stored prompt cut at `IMPLEMENTATION AND VERIFI` | `OLLAMA_PROMPT_USER_CAP = 1200` sliced model input; item `description` was `text.slice(0, 400)`; spec `prompt` max was 4000. Mid-word `slice` is what produces `VERIFI`. | No. Storage/caps. |
| `source: "merged"` | `generateWithOllama` always wrote `{ ...fallback, ...model, source: 'merged' }`. | Yes. Label only — not the recipe swap by itself. |
| Exact recipe replaced with iron+stick | Template infer invented `iron_ingot`+`stick` for any “shaped recipe”. `VANILLA_ITEMS` rejected `heavy_core` / `netherite_*` / `enchanted_golden_apple`, so valid model JSON failed Zod and fell back to that template. Spread-merge then kept the template recipe whenever the model omitted `recipes`. | Partially. Allowlist + template default + merge-of-omitted-arrays. |
| Unsolicited `legendary_mace_mob` | `wantsMob = /\bmob\b/i` matched “affects hostile mobs”. | No. Template infer. Merge then kept `fallback.mobs` when the model omitted `mobs`. |
| Unsolicited chest loot | `config.enableChestLoot` defaulted **true**; Forge always emitted GLM files. | No. Defaults + emitter. |
| Combat extras “unsupported” | Honest 1.0.5 audit: generator emitted `new Item(...)`. | No. Missing implementation. |
| No verified custom texture | Apply only copied painted/imported PNGs. Ollama does not draw. | No. |
| Description claimed unimplemented effects | Model/template copied the request into `description`. | Indirectly. |

## What 1.0.6 changes

### Request preservation and merging

- `spec.prompt` now stores up to 32 000 characters. The original request is not mid-word sliced for storage.
- Model input may still be word-boundary truncated (4 000 chars) with an explicit “full request is in spec.prompt” marker. Sequential inference / cancel / Live Activity are unchanged.
- Ollama success assembles identity fields only. It does **not** copy template mobs, worldgen, or iron+stick recipes into omitted model arrays. `source` is `ollama` when the model is used.
- “Affects hostile mobs” / “do not create a custom mob” is a combat filter, not a create-mob request.
- Chest loot and worldgen stay **off** unless explicitly requested (negation such as “chest loot stays disabled” does not enable them).
- Apply shows the file diff first. Overwrites of an existing project require Review of the current draft before Apply writes.

### Exact recipe

- Ingredients are validated against a 1.21.1 item registry (includes `enchanted_golden_apple`, `heavy_core`, `netherite_ingot`, `netherite_sword`, `breeze_rod`).
- Unknown ids fail in place. They are **never** rewritten to iron, stick, or another default.
- Prompt patterns such as `A H A / . N . / . S .` plus `A=minecraft:…` are extracted and win over model/template defaults.

### Reusable weapon + ability support

Spec, Item editor, Zod, and the Forge 1.21.1 emitter share `items[].weapon`:

- `smash` → `CraftStudioMaceItem extends MaceItem` (vanilla smash via `MaceItem.hurtEnemy`)
- compatible enchantments on the crafted item (recipe `components` + `PlayerEvent.ItemCraftedEvent`)
- direct-hit Life Steal via server `LivingDamageEvent.getAmount()` (post-armor), 20% / cap 4 / max-health clamp / hostile-only (`Enemy`, not players)
- smash shockwave after configured fall, per-wielder item cooldown, radius / damage / upward impulse, particles, `MACE_SMASH_GROUND`, action-bar cooldown feedback
- ThreadLocal blocks recursive shockwave and shockwave Life Steal
- bounded terrain: radius, one surface block per column, max blocks, allowlist, no block entities / fluids / drops
- `CraftStudioConfig.enableTerrainDestruction` disables terrain only

Fabric / Paper / Spigot / NeoForge do not emit this Java. Those platforms record the Forge-only gap when the prompt asks for weapon abilities.

### Texture

- Supported method: procedural RGBA PNG (`netherite_mace` or `generic_weapon`), 32×32, transparent background, packaged with handheld `models/item/<id>.json` → `textures/item/<id>.png`.
- Existing `craftstudio/textures/<id>.png` (hand-painted / imported) is never overwritten.
- Entity placeholder PNGs are not used as item textures.

### Completion reporting

Each requirement is tracked as `unsupported` | `generated` | `compiled` | `runtime-verified`. Exported Forge projects include `WEAPON_REQUIREMENTS.md`. This document is the app-level matrix. Unimplemented abilities are not described as working.

## Verification matrix

Statuses below are for this cloud-agent run. `generated` means the app path or fixture emitted the artifact. It is not compile or in-game proof.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Full original request stored | **generated** | Fixture prompt keeps `IMPLEMENTATION AND VERIFICATION`. Not cut at `VERIFI`. |
| No silent iron+stick substitution | **generated** | Extracted recipe + merge test keep apples / heavy_core / netherite. Unknown ids throw and are not swapped. |
| No unsolicited mob | **generated** | Legendary Mace infer/merge emits `mobs: []`. |
| Chest loot off unless requested | **generated** | `enableChestLoot=false`; no GLM / `AddBonusChestModifier` files. |
| Exact recipe `AHA / .N. / .S.` | **generated** | Recipe JSON uses the four requested vanilla ids, result count 1. |
| Mace smash Java | **generated** | `CraftStudioMaceItem extends MaceItem` + `hurtEnemy`. |
| Compatible enchantments on craft | **generated** | Recipe `minecraft:enchantments.levels` + `ItemCraftedEvent`. Density 3 / Breach 2 on the fixture. |
| Direct-hit Life Steal | **generated** | `LivingDamageEvent`, 0.2, cap 4, `Enemy` filter, shockwave flag skips heal. |
| Shockwave (≥3 fall, 10s, r=6, 8 dmg, impulse 1.0) | **generated** | `CraftStudioWeaponAbilities` + `tryShockwave`. |
| Particles / sound / cooldown feedback | **generated** | `CRIT` / `EXPLOSION`, `MACE_SMASH_GROUND`, `displayClientMessage`. |
| No recursive / shockwave Life Steal | **generated** | `SHOCKWAVE_ACTIVE` ThreadLocal. |
| Server-authoritative | **generated** | Client-side early returns; events on Forge bus. |
| Bounded terrain + config toggle | **generated** | Allowlist, `removeBlock(..., false)`, `enableTerrainDestruction`. |
| Real 32×32 item PNG + model | **generated** | Procedural PNG decodes 32×32 with opaque and transparent pixels. Model parent `handheld`, path `item/`, not `textures/entity`. |
| Targeted shockwave-radius edit | **generated** | Radius 6→8 changes only the abilities constant. Recipe, Life Steal numbers, and texture bytes stay identical. |
| App generate/apply path | **generated** | `GenerationService.generateSpec(..., 'template')` + Apply with the Legendary Mace fixture. |
| Live Ollama `qwen2.5-coder:7b` | **NOT RUN** | `127.0.0.1:11434` refused connections. No GPU/Ollama in this VM. |
| Exported Forge Gradle compile | **NOT RUN** | Java 21 is present. ForgeGradle still needs to download Minecraft 1.21.1 + Forge 52.1.16. That step was not executed here. |
| Minecraft client runtime | **NOT RUN** | No Minecraft client / display session in this VM. |

### Live Ollama (NOT RUN) — exact steps

1. Install Ollama and `qwen2.5-coder:7b` (do not use 14b/26b on ~16 GB RAM / RTX 3050 8 GB).
2. Confirm `curl http://127.0.0.1:11434/api/tags` lists that model.
3. Create a Forge 1.21.1 project. Paste the Legendary Mace request. Mode: Auto or Ollama.
4. Confirm Live Activity shows one inference, working Cancel, and `source: ollama` (not `merged`).
5. Confirm Specification Inspector `prompt` still contains `IMPLEMENTATION AND VERIFICATION`.

### Forge compile (NOT RUN) — exact steps

On a machine with Java 21 and network:

```bash
# after Apply in the project folder
./gradlew build
# Windows:
gradlew.bat build
```

Success writes `build/libs/legendary_mace-1.0.0.jar`. Compile success is **compiled**, not runtime-verified, and not a NeoForge claim.

### Minecraft client (NOT RUN) — exact steps

1. Install Minecraft 1.21.1 + official Forge 52.1.16.
2. Copy the jar into `.minecraft/mods`.
3. Craft `AHA / .N. / .S.` and confirm the item texture (netherite handle, metallic head, gold edge, purple cracks, golden core).
4. Confirm Density/Breach on the crafted stack.
5. Hit a hostile mob: Life Steal heals 20% of actual damage, cap 4, no player/passive heal.
6. Fall ≥3 blocks and smash: shockwave r=6, 8 damage, impulse 1.0, particles/sound, 10s cooldown, no self-retrigger, no Life Steal on shockwave hits.
7. Confirm at most one allowlisted surface block per column, ≤24, no drops / fluids / block entities.
8. Set `enableTerrainDestruction` false in `config/legendary_mace.json`; shockwave remains, terrain stops.

## npm gates (this run)

| Gate | Result |
| --- | --- |
| `npm test` | **PASS** — 164 tests |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `electron-vite build` | **PASS** — `out/build-info.json` version **1.0.6** |

## Remaining limitations

- Forge 1.21.1 only for executable smash / Life Steal / shockwave / terrain Java.
- Compatible vanilla enchantments only. No custom enchantment registry.
- Procedural texture is a painted pixel recipe, not an in-game screenshot proof.
- Compile and client runtime stay **NOT RUN** until the steps above are executed on a Windows/dev machine.
- Template fallback after a failed Ollama repair is still not Legendary Mace completion.
- Unspecified “add a shaped recipe” prompts may still emit a placeholder iron+stick grid. An explicit pattern+keys in the request always wins.

## Files touched (high level)

- Spec / merge / registry / weapon: `src/shared/spec.ts`, `specMerge.ts`, `specPrompt.ts`, `specNormalize.ts` (unchanged aliases), `templateInfer.ts`, `vanillaRegistry.ts`, `weaponSpec.ts`, `recipeExtract.ts`, `promptPreserve.ts`, `requirementStatus.ts`, `specInspector.ts`, `editorSpec.ts`, `ollamaLimits.ts` (cap still used for other callers), `ollamaSpecSchema.ts`
- Services: `src/main/services/generationService.ts`
- Forge codegen: `src/main/codegen/forge/emitter.ts`, `weapons/forgeWeapon.ts`, `textures/proceduralWeapon.ts`, `recipes/json.ts`, `config/modConfig.ts`, `allowlist.ts`
- UI: `ItemEditor.tsx`, `DesignGenerate.tsx`, `SpecInspector.tsx`, `AppShell.tsx`, `SettingsPage.tsx`
- Version: `package.json`, `package-lock.json`, `buildInfo.ts`, `README.md`
- Tests: `tests/forgeWeaponWorkflow.test.ts`, `tests/fixtures/legendaryMaceRequest.ts`, plus 1.0.5 fixture/version updates
- Docs: this file
