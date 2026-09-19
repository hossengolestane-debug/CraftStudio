# Phase 1 report

CraftStudio Local Phase 1 is a real Electron + React + TypeScript desktop app at the repository root. It creates local project folders, talks to Ollama only through a configurable local HTTP endpoint, and leaves generation / Gradle / Minecraft testing unimplemented on purpose.

## What works

- `npm install`, `npm test`, `npm run build`, and `npm run lint` (see “What was tested”)
- Electron main + sandboxed renderer with a **narrow typed IPC API** (`window.craftstudio`)
- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` on `webPreferences`
- UI shell: Projects, Create, Assets, Settings; when a project is open, Design / Code / Test (Design is the default)
- Create wizard persists a project, then shows Build/Test and Export as **disabled stubs**
- Projects can be listed, opened, renamed, and deleted through `ProjectService`
- Settings JSON (projects path, Ollama endpoint, timeout, last opened id)
- Ollama `GET {endpoint}/api/tags` with timeout and cancel; lists installed models when the daemon is up
- Adapter objects for Fabric, NeoForge, Forge, Paper, Spigot plus a compatibility registry
- Path confinement for every project file write
- Actionable errors with expandable technical details
- Keyboard: Ctrl/Cmd+1–4 for primary nav, arrow keys in the sidebar, visible `:focus-visible` rings

## Snapshots (not in-session undo)

On create, the service writes `snapshots/created.manifest.json`. Later metadata edits overwrite the live manifest and bump `updatedAt`. There is **no** in-session undo stack in Phase 1. Restore means copying the create-time snapshot back by hand.

## What was tested

Automated (Vitest):

- Path safety: `..`, slashes, absolute segments, null bytes, reserved Windows names, resolved escapes
- Manifest validation: schema, UUID, type/platform pairing, version shape
- Adapter registry: five adapters, contract fields, plugin capability gaps
- Compatibility lookup: Experimental vs Unsupported; **zero Tested rows**
- Project service: create writes a real manifest; `list()` reloads it from disk; rename/delete; unsupported combo rejected
- Ollama service: mocked `/api/tags` connected + model list; refused connection; cancel

Manual / agent verification after implement:

- `npm test`
- `npm run build` (electron-vite production compile of main, preload, renderer)
- `npm run lint` and `npm run typecheck`
- Real `ProjectService.create` + `list` against a temp directory
- Live Electron window on Linux: create wizard wrote `River Stones` to
  `~/.config/craftstudio-local/CraftStudioProjects/river-stones-aa5fd52b/craftstudio.project.json`
  and the Projects list reloaded it
- Real Ollama check against `http://localhost:11434` while the daemon was down: **Not connected**, with an explicit no-cloud-fallback recovery message. A mock `/api/tags` server reports connected and lists models.

This Linux container needed `CRAFTSTUDIO_NO_SANDBOX=1` plus Chromium `--no-zygote` for the renderer to stay alive. That is documented; it does not disable the preload bridge.

Compatibility badges: **nothing is Tested**. No Minecraft loader, plugin jar, or Gradle build was executed.

## Known limitations

- Assets, Monaco/Code, Minecraft Test, Gradle generation, and Export are absent or visibly disabled
- Feature flags in the manifest are stubs; they do not emit items/mobs/GUIs
- Plugin adapters correctly report that arbitrary new client entities and custom block models are unsupported
- Ollama generation is Phase 2 — Settings only checks `/api/tags`
- Project rename changes the display name, not the folder name
- No installer / electron-builder packaging in this phase (`npm run build` compiles, it does not ship an `.exe`)
- Linux cloud/CI environments may need `CRAFTSTUDIO_NO_SANDBOX=1` (Chromium sandbox, not the preload bridge)

## High-level files

| Area | Paths |
| --- | --- |
| Tooling | `package.json`, `electron.vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `eslint.config.js` |
| Main / services | `src/main/index.ts`, `src/main/ipc.ts`, `src/main/services/*` |
| Preload | `src/preload/index.ts`, `src/preload/index.d.ts` |
| Shared domain | `src/shared/types.ts`, `manifest.ts`, `compatibility.ts`, `adapters/*` |
| UI | `src/renderer/src/App.tsx`, `pages/*`, `components/*` |
| Tests | `tests/*.test.ts` |
| Docs | `README.md`, `PHASE1.md`, `docs/PROJECT_MANIFEST.md` |

## Recommended Phase 2

1. **Structured Ollama generation** — send the manifest + adapter capabilities to a local model and require a JSON spec (items, recipes, commands) validated with the same strictness as today’s manifest parser.
2. **Validated spec store** — write `spec.json` next to the manifest; reject capabilities the adapter marks unsupported (especially plugin client entities).
3. **First real adapter emission** — pick **Fabric** (or Paper if plugins-first) and emit a real Gradle tree from a checked-in template, then run `gradle build` in a follow-up phase before any row is marked Tested.
4. **Monaco on the Code tab** bound to those generated files — still no fake “Build succeeded” until Gradle actually returns zero.
