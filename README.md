# CraftStudio Local

Desktop app that helps beginners create **Minecraft Java Edition** mods and server plugins using **local Ollama**.

| Mods | Plugins |
| --- | --- |
| Fabric, NeoForge, Forge | Paper, Spigot |

**Phase 2** is implemented: a user can create a Fabric 1.21 / 1.21.1 project, describe a simple item, get a Zod-validated spec, and emit a real Gradle tree from trusted templates. Other adapters stay honest stubs.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- JDK 21 on PATH to run `./gradlew build` (generation still works without it)
- Windows, macOS, or Linux (docs are Windows-first; the code is portable)

Optional: [Ollama](https://ollama.com) at `http://localhost:11434` for requests templates cannot express. Simple items generate **without** Ollama.

## How to run

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
npm test
npm run lint
npm run typecheck
```

On some Linux containers:

```bash
CRAFTSTUDIO_NO_SANDBOX=1 npm run dev
```

## Vertical slice (Phase 2)

1. Create a **Fabric** project on **Minecraft 1.21 or 1.21.1**.
2. Open **Design**. Describe an item (or keep the project description).
3. Click **Generate specification** (Auto or Template only).
4. Review the spec. Click **Apply files**.
5. Open **Code** to read the tree. Open **Test** to run `./gradlew build` if Java 21 is installed.

Trusted templates emit Gradle, `fabric.mod.json`, a `ModInitializer`, lang, a placeholder item model, and optional shapeless recipes. Ollama may only propose spec JSON. That JSON is independently validated; invalid output is repaired at most a few times, then the template spec is kept. **Nothing is written from unvalidated model text.**

## Architecture

```text
src/main/          Electron main (projects, Ollama, generation, Gradle)
src/main/codegen/  Fabric templates + vendored Gradle wrapper
src/preload/       Restricted contextBridge
src/renderer/      React UI
src/shared/        Manifest, Zod spec, adapters, compatibility
```

| Service | Responsibility |
| --- | --- |
| `ProjectService` | Folders + manifests |
| `GenerationService` | Template infer → optional Ollama → Zod → apply |
| `OllamaService` | `/api/tags` and streamed `/api/chat` |
| Path safety | Projects root **and** the open project folder |
| `GradleService` | Allowlisted `gradlew build --no-daemon --stacktrace` only |

Default projects root: `<userData>/CraftStudioProjects`

Pinned app stack: Electron 39, electron-vite 5, Vite 7, React 19, TypeScript 5.9, Tailwind 4, Zod 3, Vitest 3.

Fabric pins (from [fabricmc.net/develop](https://fabricmc.net/develop/) / example-mod era versions): Loom 1.9.2, Yarn, Loader 0.16.10, Fabric API matching 1.21 / 1.21.1, Gradle 8.11.1, Java 21. Yarn is used so generated Java matches the Fabric wiki item tutorial.

## Honesty

- NeoForge, Forge, Paper, Spigot: no Gradle emission
- Fabric versions other than 1.21 / 1.21.1: no codegen
- No Minecraft `runClient`, no texture editor, no mob/GUI generators
- Compatibility rows are still **not Tested** until a Minecraft client run is verified
- Model output cannot write outside the project or run a shell

See [PHASE1.md](PHASE1.md) and [PHASE2.md](PHASE2.md).
