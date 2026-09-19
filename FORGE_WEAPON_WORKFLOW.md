# 1.0.7 Forge 1.21.1 weapon workflow

Legendary Mace is the acceptance case. The implementation is reusable (`items[].weapon` + Forge Java templates). It is **not** a one-item special case and is **not complete**. Do **not** Apply this draft to the user’s on-disk Legendary Mace project. Present the corrected fixture first.

Windows packaging target after this lands: **`E:\CraftStudio Local 1.0.7\`**. Keep older version folders (`1.0.3`–`1.0.6`). Coordinator packages Windows binaries after this change set. About must show **1.0.7**.

Full corrected spec (in-memory / fixture only; not Applied):

- `tests/fixtures/legendaryMace.craftstudio.spec.json`
- `LEGENDARY_MACE_SPEC.json` (same bytes; coordinator can show this before Apply)
- Texture bytes: `tests/fixtures/legendary_mace.png` (32×32 RGBA, 463 bytes on this run)

## What 1.0.6 verification still hit

User verification of 1.0.6 was substantially better, but Apply was correctly withheld. Remaining defects:

| Symptom | Root cause | Fixed in 1.0.7? |
| --- | --- | --- |
| Stored prompt still cut at `IMPLEMENTATION AND VERIFI` | Design feature-prompt `maxLength={4000}` and Create/Design/manifest description `maxLength` / 2000-char cap were hard slices. Design seeded Generate from the truncated project description. Mid-word `slice` is what produces `VERIFI`. Storage Zod (`spec.prompt` 32 000) was already large enough. | Yes. Archive cap is 32 000 on the feature prompt, Create description, and manifest. `spec.prompt` is restored from the applied/generated spec. Model input may still word-boundary truncate at 4 000 with an explicit marker. |
| Recipe still drifted from `AHA / .N. / .S.` | Extractor only accepted spaced rows or `A/B/C` slash form. YAML/JSON quoted rows (`- "AHA"`) returned null. Template then emitted iron+stick when a shaped recipe was requested. Partial Ollama weapons kept their own iron+stick grid when extract failed. | Yes. Quoted / JSON / slash / spaced grids extract. Extracted keys+pattern always overwrite model/template recipes. Iron/stick is never substituted when the prompt lists `A=minecraft:…` keys. |
| `textureStyle: "none"` / no PNG on disk | `attachInferredWeapon` treated any Ollama weapon with smash/lifesteal as complete and kept Zod’s default `textureStyle: "none"`. PNGs are only generated when style ≠ `none`. This task does not Apply to the user project, so 1.0.6 also never wrote fixture bytes in-repo. | Yes. Merge fills `netherite_mace` when a custom texture was requested. Fixture PNG bytes are committed and decoded in tests. |
| Enchantments only Fire Aspect II | Named-only parse kept whatever the model emitted. Density 3 + Breach 2 are mutually exclusive on a 1.21.1 mace, so a partial model list (Fire Aspect II) was treated as finished. | Yes. Highest mutually compatible 1.21.1 mace set is filled and reported (see list below). |
| Apply allowed a drifting draft | Review-before-overwrite existed; recipe/texture/enchantment fidelity was not a hard Apply gate. | Yes. `APPLY_BLOCKED` with actionable UI errors. |

## Enchantments (Forge / Minecraft 1.21.1)

Resolved against the 1.21.1 registry. Density, Breach, Sharpness, Smite, and Bane of Arthropods are mutually exclusive. Density (max 5) is preferred over Breach (max 4). Vanishing Curse is compatible but is a curse and is not auto-applied.

**Highest mutually compatible beneficial mace set (this is what the corrected spec records):**

| Enchantment | Level | Notes |
| --- | --- | --- |
| `minecraft:density` | **5** | Exclusive vs Breach / Smite / Bane / Sharpness |
| `minecraft:wind_burst` | **3** | Mace exclusive, compatible with Density |
| `minecraft:fire_aspect` | **2** | Compatible |
| `minecraft:unbreaking` | **3** | Compatible |
| `minecraft:mending` | **1** | Compatible |

Fire Aspect II alone is incomplete. Density 3 + Breach 2 from the original prose is **not** used because those two cannot coexist.

## What 1.0.7 changes

- Capture/storage: feature prompt and project description use the 32 000 archive cap. `spec.prompt` (and the Generate textarea after generate/load) keeps the complete original request. Model input may truncate at a **word boundary** only, with `[Full original request is stored untruncated in spec.prompt; this excerpt is model-input only.]`.
- Extract/merge: YAML `- "AHA"` / JSON `["AHA",".N.",".S."]` / spaced / slash patterns extract. Extracted grid always wins. No iron/stick when keys were specified.
- Weapon merge: partial model weapons receive inferred `textureStyle` and the highest compatible enchantment set.
- Apply blockers when any of: recipe ≠ requested grid; `textureStyle` is `none` while a custom texture was requested; required PNG bytes are absent; enchantment selection is incomplete/unreported; stored prompt is mid-word truncated.
- Unsolicited mobs, GUIs, worldgen, and chest loot stay empty/disabled.
- Deterministic correction pass = `inferSpecFromPrompt` + `assembleGeneratedSpec` on the full request. Output is the committed fixture, not the user’s AppData project.

## Verification matrix

Statuses: `unsupported` | `generated` | `compiled` | `runtime-verified`.

`generated` means the app path or committed fixture emitted the artifact. It is **not** compile or in-game proof. Legendary Mace is **not** reported complete.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Full original request stored | **generated** | Fixture `spec.prompt` contains `IMPLEMENTATION AND VERIFICATION` and does not end at `VERIFI`. UI 4000/2000 hard slices removed. |
| Exact recipe `AHA / .N. / .S.` | **generated** | Keys: enchanted_golden_apple, heavy_core, netherite_ingot, netherite_sword. resultItemId `legendary_mace`, count 1. YAML/JSON extract test + merge overwrite test. |
| Custom texture (not `none`) | **generated** | `textureStyle: "netherite_mace"`. Committed `tests/fixtures/legendary_mace.png` decodes 32×32 with opaque + transparent pixels (463 bytes). Item model `minecraft:item/handheld` → `legendary_mace:item/legendary_mace`. |
| Enchantment selection reported | **generated** | Density 5, Wind Burst 3, Fire Aspect 2, Unbreaking 3, Mending 1 on the spec and in the inspector. |
| No unsolicited mob / GUI / worldgen / loot | **generated** | `mobs`, `modGuis`, `pluginGuis`, `worldgen` are `[]`; `enableChestLoot` and `enableWorldgen` are false. |
| Apply blockers | **generated** | Iron+stick / `textureStyle: none` / missing PNG / Fire Aspect II-only / truncated prompt → `APPLY_BLOCKED`. Corrected fixture → no blockers. |
| App generate path (template) | **generated** | `GenerationService.generateSpec(..., 'template')` in a **temp** project. This run did **not** Apply to the user’s Legendary Mace folder. |
| Exported Gradle compile | **NOT RUN** | Java 21 is present. ForgeGradle still needs Minecraft 1.21.1 + Forge 52.1.16 downloads. Not executed. |
| Live Ollama `qwen2.5-coder:7b` | **NOT RUN** | `127.0.0.1:11434` refused. No GPU/Ollama in this VM. |
| Minecraft client runtime | **NOT RUN** | No Minecraft client / display session in this VM. |

### Live Ollama (NOT RUN) — exact steps

1. Install Ollama and `qwen2.5-coder:7b` (do not use 14b/26b on ~16 GB RAM / RTX 3050 8 GB).
2. Confirm `curl http://127.0.0.1:11434/api/tags` lists that model.
3. Create a **new** Forge 1.21.1 project (do not overwrite the existing Legendary Mace folder until the user accepts the fixture).
4. Paste the full request into Design → Generate (not only a 2000-character description). Mode: Auto or Ollama.
5. Confirm Live Activity shows one inference, working Cancel, `source: ollama` (not `merged`), and Specification Inspector `prompt` still contains `IMPLEMENTATION AND VERIFICATION`.
6. Confirm the inspector lists Density 5, Wind Burst 3, Fire Aspect 2, Unbreaking 3, Mending 1 and `textureStyle` is not `none`.
7. Review the fixture JSON with the user. Apply only after they accept it.

### Forge compile (NOT RUN) — exact steps

On a machine with Java 21 and network, after the user accepts Apply:

```bash
# after Apply in the project folder
./gradlew build
# Windows:
gradlew.bat build
```

Success writes `build/libs/legendary_mace-1.0.0.jar`. That is **compiled**, not runtime-verified, and not a NeoForge claim.

### Minecraft client (NOT RUN) — exact steps

1. Install Minecraft 1.21.1 + official Forge 52.1.16.
2. Copy the jar into `.minecraft/mods`.
3. Craft `AHA / .N. / .S.` and confirm the 32×32 item texture (dark netherite handle, metallic head, gold edging, purple cracks around a golden core).
4. Confirm Density V, Wind Burst III, Fire Aspect II, Unbreaking III, Mending I on the crafted stack.
5. Hit a hostile mob: Life Steal heals 20% of actual damage, cap 4, no player/passive heal.
6. Fall ≥3 blocks and smash: shockwave r=6, 8 damage, impulse 1.0, particles/sound, 10s cooldown, no self-retrigger, no Life Steal on shockwave hits.
7. Confirm at most one allowlisted surface block per column, ≤24, no drops / fluids / block entities.
8. Set `enableTerrainDestruction` false in `config/legendary_mace.json`; shockwave remains, terrain stops.

## npm gates (this run)

| Gate | Result |
| --- | --- |
| `npm test` | **PASS** — 169 tests |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `electron-vite build` | **PASS** — `out/build-info.json` version **1.0.7** |

## Remaining limitations

- Legendary Mace is **not complete**. Recipe/texture/enchantment **generated** status is not compile or runtime proof.
- This change set does not Apply or overwrite the user’s existing project.
- Forge 1.21.1 only for executable smash / Life Steal / shockwave / terrain Java.
- Compatible vanilla enchantments only. No custom enchantment registry.
- Procedural texture is a painted pixel recipe, not an in-game screenshot.
- Unspecified “add a shaped recipe” prompts with **no** keys may still show the editor default iron+stick grid. An explicit pattern+keys request never uses that default.
- Template fallback after a failed Ollama repair is still not Legendary Mace completion.

## Files touched (high level)

- Prompt / recipe / weapon: `promptPreserve.ts`, `recipeExtract.ts`, `weaponSpec.ts`, `vanillaRegistry.ts`, `specMerge.ts`, `templateInfer.ts`, `applyBlockers.ts`, `specPrompt.ts`, `manifest.ts`, `errors.ts`
- Services / UI: `generationService.ts`, `DesignGenerate.tsx`, `CreateWizard.tsx`, `SpecInspector.tsx`, `ItemEditor.tsx`, `AppShell.tsx`, `SettingsPage.tsx`
- Version: `package.json`, `package-lock.json`, `buildInfo.ts`, `README.md`
- Fixtures: `tests/fixtures/legendaryMace.craftstudio.spec.json`, `tests/fixtures/legendary_mace.png`, `LEGENDARY_MACE_SPEC.json`, `tests/fixtures/legendaryMaceRequest.ts`
- Tests / docs: `tests/forgeWeaponWorkflow.test.ts`, this file

## Full corrected `craftstudio.spec.json`

```json
{
  "schemaVersion": 1,
  "modId": "legendary_mace",
  "displayName": "Legendary Mace",
  "description": "Legendary Mace",
  "packageName": "local.craftstudio.legendary_mace",
  "mainClass": "LegendaryMace",
  "items": [
    {
      "id": "legendary_mace",
      "displayName": "Legendary Mace",
      "description": "Create a Forge 1.21.1 weapon called \"Legendary Mace\".",
      "maxCount": 1,
      "rarity": "epic",
      "modelStyle": "handheld",
      "layer1": false,
      "durability": 500,
      "attributes": [
        {
          "id": "attack_damage",
          "amount": 8,
          "slot": "mainhand"
        },
        {
          "id": "attack_speed",
          "amount": -2.4,
          "slot": "mainhand"
        }
      ],
      "weapon": {
        "smash": true,
        "enchantments": [
          { "id": "minecraft:density", "level": 5 },
          { "id": "minecraft:wind_burst", "level": 3 },
          { "id": "minecraft:fire_aspect", "level": 2 },
          { "id": "minecraft:unbreaking", "level": 3 },
          { "id": "minecraft:mending", "level": 1 }
        ],
        "lifeSteal": { "enabled": true, "percent": 0.2, "capHealth": 4, "hostileOnly": true },
        "shockwave": {
          "enabled": true,
          "minFallBlocks": 3,
          "cooldownSeconds": 10,
          "radius": 6,
          "damage": 8,
          "upwardImpulse": 1
        },
        "terrain": {
          "enabled": true,
          "radius": 3,
          "maxBlocks": 24,
          "allowBlocks": [
            "minecraft:dirt",
            "minecraft:grass_block",
            "minecraft:stone",
            "minecraft:sand",
            "minecraft:gravel"
          ]
        },
        "textureStyle": "netherite_mace"
      }
    }
  ],
  "blocks": [],
  "recipes": [
    {
      "id": "legendary_mace_shaped",
      "type": "shaped",
      "resultItemId": "legendary_mace",
      "resultCount": 1,
      "ingredients": [],
      "pattern": ["AHA", ".N.", ".S."],
      "keys": [
        { "symbol": "A", "kind": "vanilla", "id": "minecraft:enchanted_golden_apple" },
        { "symbol": "H", "kind": "vanilla", "id": "minecraft:heavy_core" },
        { "symbol": "N", "kind": "vanilla", "id": "minecraft:netherite_ingot" },
        { "symbol": "S", "kind": "vanilla", "id": "minecraft:netherite_sword" }
      ]
    }
  ],
  "commands": [],
  "mobs": [],
  "modGuis": [],
  "pluginGuis": [],
  "worldgen": [],
  "config": {
    "enableWorldgen": false,
    "enableChestLoot": false,
    "spawnWeightScale": 1,
    "enableTerrainDestruction": true
  },
  "unsupportedRequests": [],
  "source": "template",
  "prompt": "Create a Forge 1.21.1 weapon called \"Legendary Mace\".\n\nRecipe shape:\nA H A\n. N .\n. S .\nKeys: A=minecraft:enchanted_golden_apple, H=minecraft:heavy_core, N=minecraft:netherite_ingot, S=minecraft:netherite_sword, .=empty\nOutput: one Legendary Mace.\n\nCombat: mace smash. Enchant the crafted item with compatible mace enchantments Density 3 and Breach 2.\nDirect-hit Life Steal: 20% of actual health damage, capped at 4 health points, respecting max health.\nAffects hostile mobs only. Exclude players and passive mobs. Do not create a custom mob.\nSmash-triggered shockwave after a fall of at least 3 blocks. Per-wielder cooldown 10 seconds.\nRadius 6 blocks, 8 damage to other eligible targets, upward impulse 1.0 blocks/tick.\nParticles, sound, cooldown feedback. Prevent recursive activation and shockwave Life Steal. Server-authoritative.\n\nBounded terrain: radius 3 blocks; at most one surface block per column; max 24 blocks total.\nAllow only dirt, grass_block, stone, sand, gravel. Exclude block entities and fluids; no block drops.\nConfig toggle that disables terrain destruction while retaining the shockwave.\n\nTexture: original 32×32 transparent PNG. Dark netherite handle, metallic head, gold edging, purple cracks around a golden core. Package the file and item-model references. Do not use an entity texture.\n\nChest loot stays disabled. IMPLEMENTATION AND VERIFICATION must keep this full request, including this IMPLEMENTATION AND VERIFICATION sentence, without mid-word truncation."
}
```
