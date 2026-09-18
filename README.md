# CraftStudio Local

Desktop app that helps beginners create **Minecraft Java Edition** mods and server plugins using **local Ollama**.

| Mods | Plugins |
| --- | --- |
| Fabric, NeoForge, Forge | Paper, Spigot |

This repository currently implements **Phase 1**: a real Electron shell, local project files, adapter/compatibility scaffolding, and an honest Ollama connection check. It does **not** generate Gradle projects, Java sources, textures, or Minecraft test runs.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- Windows, macOS, or Linux (docs below are Windows-first; the code is portable)

Optional: [Ollama](https://ollama.com) running locally at `http://localhost:11434`.

## How to run

```bash
npm install
npm run dev
```

`npm run dev` starts Vite and launches the Electron window (main + renderer).

Production compile (main, preload, and renderer):

```bash
npm run build
npm run preview
```

Tests and lint:

```bash
npm test
npm run lint
npm run typecheck
```

On some Linux containers Electron needs an extra Chromium flag:

```bash
# PowerShell
$env:CRAFTSTUDIO_NO_SANDBOX="1"; npm run dev

# bash
CRAFTSTUDIO_NO_SANDBOX=1 npm run dev
```

`CI=true` also enables that flag.

## What Phase 1 does

- Create, list, open, rename, and delete **real folders** under a configurable projects root
- Write `craftstudio.project.json` (see [docs/PROJECT_MANIFEST.md](docs/PROJECT_MANIFEST.md))
- Progressive create wizard: type → platform & version → describe → review → build/test & export stubs
- Compatibility badges: **Experimental** or **Unsupported** only (nothing is Tested until a Minecraft build is actually verified)
- Settings JSON: projects path, Ollama endpoint, last opened project
- Live Ollama check via `GET /api/tags` with timeout and cancel — no cloud fallback
- Disabled Assets / Code / Test / Export surfaces that never fake success

## Architecture

```text
src/main/          Electron main process (Node services + IPC handlers)
src/preload/       Restricted contextBridge (nodeIntegration OFF, contextIsolation ON)
src/renderer/      React + TypeScript + Tailwind UI
src/shared/        Manifest, adapters, compatibility registry (no Node fs)
```

The renderer never talks to the filesystem or Ollama directly. It calls a typed `window.craftstudio` API exposed by the preload script.

| Service | Responsibility |
| --- | --- |
| `SettingsService` | `<userData>/settings.json` |
| `ProjectService` | Project folders + manifests + create-time snapshots |
| `OllamaService` | Local `/api/tags` with `AbortController` |
| Path safety | Reject traversal and writes outside the projects root |

Default projects root: `<userData>/CraftStudioProjects`  
Home alternative: `~/CraftStudioProjects`

Pinned stack (verified against current npm peer ranges before install):

- Electron 39 + electron-vite 5 + Vite 7
- React 19 + TypeScript 5.9
- Tailwind CSS 4
- Vitest 3

## Phase 1 scope (honest)

**In:** runnable app, UI shell, local projects, wizard persistence, adapter stubs, compatibility registry, Ollama detection, tests, docs.

**Out:** structured LLM generation, Gradle emission, Minecraft launch, Monaco, texture editor, export packaging.

See [PHASE1.md](PHASE1.md) for what was tested and the recommended Phase 2 path.
