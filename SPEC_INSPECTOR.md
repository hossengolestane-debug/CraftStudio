# 1.0.5 Specification Inspector + Legendary Mace audit

Do **not** merge this as a feature phase. This adds a Design-page inspector and an honest Forge capability report. Phases 1–10 and 1.0.1–1.0.4 stay in place.

## Specification Inspector

On **Design**, directly below the generation / saved-spec results card:

- Expandable **read-only JSON** of the **current in-memory draft** (the spec **Apply** consumes). Not the truncated Live Activity AI preview.
- **Copy full JSON** and **Export specification.json** (path-confined write inside the project folder via `writeProjectFile` / `resolveProjectFile`; filename is allowlisted).
- Item-editor and other Design edits update the inspector immediately (same `workingSpec` draft).
- **Current draft** vs **Last applied** (`craftstudio.spec.json` mtime, or “not applied yet”).
- **unsupportedRequests** listed as `feature` + `reason` above the JSON, not only inside the collapsed dump.
- Inspecting does **not** require generating again.
- Beginner layout, black/white theme, native `<details>` / buttons (keyboard accessible).

Export writes `specification.json` next to the project files. It does **not** replace `craftstudio.spec.json`. Apply still writes the applied spec.

## Legendary Mace / Forge generator audit

Schema-valid JSON and description text are **not** feature completeness. Findings:

| Feature | Status | Evidence |
| --- | --- | --- |
| Mace smash mechanics | **DESCRIPTION/UNSUPPORTED ONLY** | Forge registers `new Item(...)`. No mace item type, smash attack, Density, Breach, or wind-charge smash handler. Prompt match goes to `unsupportedRequests` (`mace combat`). |
| Enchantments | **DESCRIPTION/UNSUPPORTED ONLY** | No Enchantment registry or custom enchantment class. Recorded as `enchantments`. |
| Life Steal | **DESCRIPTION/UNSUPPORTED ONLY** | No on-hit healing / hurt-event handler. Recorded as `life steal`. |
| Shockwaves | **DESCRIPTION/UNSUPPORTED ONLY** | No AOE damage. Recorded as `shockwave / terrain`. |
| Terrain destruction | **DESCRIPTION/UNSUPPORTED ONLY** | No block-break-on-hit. Same unsupported bucket as shockwaves. |
| Custom texture generation | **DESCRIPTION/UNSUPPORTED ONLY** | Ollama suggests hex palettes only; it does not draw PNGs. Entity skin is a placeholder PNG. `pack.png` is a CraftStudio mark. |

**What Forge *does* emit** (real codegen that can affect gameplay):

- Generic custom item with durability / stack size
- Optional `attack_damage` / `attack_speed` / armor / health / movement attributes
- Shaped/shapeless recipes (allowlisted ingredients only)
- Stub commands
- Item models (`generated` / `handheld`)
- **Hand-painted or imported PNG attach-on-apply** — if `craftstudio/textures/<id>.png` exists, Apply copies it into the jar. That pipeline is **IMPLEMENTED**. It is not AI texture generation. Unpainted items do not get an invented texture.

This task does **not** fake-implement smash, life steal, shockwaves, enchantments, or terrain edits.

## Checks

| Check | Result |
| --- | --- |
| Inspector helpers + path-confined export + applied-vs-draft | Run with `npm test` |
| Forge emitter has no smash / life steal / enchantment / shockwave Java | Run with `npm test` |
| `npm test` / lint / typecheck / `electron-vite build` | **PASS** — 155 tests, eslint clean, `tsc` both projects, `electron-vite build` wrote `out/` and `out/build-info.json` (1.0.5) |
| Electron Design UI click-through | **NOT RUN** on the cloud VM (no desktop session) |
| Live Ollama / Minecraft client | **NOT RUN** |

## Windows install

Version is **1.0.5**. After rebuild, copy into **`E:\CraftStudio Local 1.0.5\`**. Keep older version folders and the existing projects directory (Legendary Mace lives there). Settings → About must show **1.0.5**.
