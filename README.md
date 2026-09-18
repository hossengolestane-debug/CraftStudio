# CraftStudio Local

Desktop app that helps beginners create **Minecraft Java Edition** mods and server plugins using **local Ollama**.

| Mods | Plugins |
| --- | --- |
| Fabric, NeoForge, Forge | Paper, Spigot |

**Phase 3** is implemented: Fabric codegen for 1.21 / 1.21.1 / 1.21.2 / 1.21.4 / 1.21.8, a real Paper plugin slice from the same spec, source ZIP + JAR export, and a structured item editor. NeoForge, Forge, and Spigot stay honest stubs. Compatibility rows stay **Experimental** until a real Minecraft runtime is verified.

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

## Vertical slice (Phase 3)

1. Create a **Fabric** project on **1.21, 1.21.1, 1.21.2, 1.21.4, or 1.21.8**, or a **Paper** project on **1.21 / 1.21.1 / 1.21.4 / 1.21.8**.
2. Open **Design**. Describe an item, or edit name / id / stack size / recipe in the item editor (no Ollama required).
3. Click **Generate specification**, review, then **Apply files** (diffs first).
4. Open **Code** to read the tree. Open **Test** to run `./gradlew build`. Open **Export** for a source ZIP or a built JAR after a successful build.

Fabric 1.21 / 1.21.1 uses classic `Registry.register`. Fabric 1.21.2+ uses `Items.register` + `RegistryKey`. Paper items are vanilla `Material.PAPER` + persistent data — clients do not see a new item id. **Spigot is not inferred from Paper.**

Ollama may only propose spec JSON. That JSON is independently validated. **Nothing is written from unvalidated model text.** Java and Gradle stay template-authored.

## Architecture

```text
src/main/          Electron main (projects, Ollama, generation, Gradle, export)
src/main/codegen/  Fabric + Paper templates + vendored Gradle wrapper
src/preload/       Restricted contextBridge
src/renderer/      React UI
src/shared/        Manifest, Zod spec, adapters, compatibility, version pins
```

Pinned app stack: Electron 39, electron-vite 5, Vite 7, React 19, TypeScript 5.9, Tailwind 4, Zod 3, Vitest 3.

Fabric pins come from [fabricmc.net/develop](https://fabricmc.net/develop/) / Fabric Meta. Paper pins use official `paper-api` coordinates from repo.papermc.io.

## Honesty

- NeoForge, Forge, Spigot: no Gradle emission
- Fabric / Paper versions without a pin: no codegen
- Compatibility rows are **not Tested** until a Minecraft client or Paper server run is verified
- `runClient` requires an explicit Minecraft EULA checkbox; CraftStudio never silent-accepts and never distributes game files
- Model output cannot write outside the project or run a shell

See [PHASE1.md](PHASE1.md), [PHASE2.md](PHASE2.md), and [PHASE3.md](PHASE3.md).
