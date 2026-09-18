# CraftStudio Local

Desktop app that helps beginners create **Minecraft Java Edition** mods and server plugins using **local Ollama**.

| Mods | Plugins |
| --- | --- |
| Fabric, NeoForge, Forge | Paper, Spigot |

**Phase 4** is implemented: Fabric 1.21.x, Paper 1.21.x, NeoForge 1.21.1, a pixel texture editor, resource-pack export, Monaco on the code tree, and evidence-gated **Tested** status. Forge and Spigot stay honest stubs. A compile-only Gradle build never flips Tested.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- JDK 21 on PATH to run `./gradlew build` (generation still works without it)
- Windows, macOS, or Linux (docs are Windows-first; the code is portable)

Optional: [Ollama](https://ollama.com) at `http://localhost:11434` for requests templates cannot express. Simple items generate **without** Ollama. Ollama may also suggest a texture palette — it does not draw PNGs.

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

## Vertical slice (Phase 4)

1. Create a **Fabric** 1.21.x project, a **Paper** 1.21.x project, or **NeoForge 1.21.1**.
2. Open **Design**. Describe an item, or edit it in the item editor (no Ollama required).
3. Click **Generate specification**, review, then **Apply files** (diffs first).
4. Open **Assets**. Paint or import a 16×16 / 32×32 PNG. Save it into the project.
5. Open **Export** for a source ZIP, a built JAR after `./gradlew build`, or a resource pack.
6. Open **Test** for a real Gradle compile. Runtime verification (and Tested) is a separate, evidence-gated step.

Fabric 1.21 / 1.21.1 uses classic `Registry.register`. Fabric 1.21.2+ uses `Items.register` + `RegistryKey`. NeoForge uses `DeferredRegister.Items` and is **not** Forge. Paper items are vanilla `Material.PAPER` + PDC + CustomModelData — **clients must install the exported resource pack**. **Spigot is not inferred from Paper.**

Ollama may only propose spec JSON (or a color palette). That JSON is independently validated. **Nothing is written from unvalidated model text.** Java and Gradle stay template-authored.

## Architecture

```text
src/main/          Electron main (projects, Ollama, generation, Gradle, export, textures, evidence)
src/main/codegen/  Fabric + Paper + NeoForge templates + vendored Gradle wrapper
src/preload/       Restricted contextBridge
src/renderer/      React UI (including Monaco + texture editor)
src/shared/        Manifest, Zod spec, adapters, compatibility, pins, PNG, evidence
```

Pinned app stack: Electron 39, electron-vite 5, Vite 7, React 19, TypeScript 5.9, Tailwind 4, Zod 3, Vitest 3, Monaco 0.52.

Fabric pins come from [fabricmc.net/develop](https://fabricmc.net/develop/) / Fabric Meta. Paper pins use official `paper-api` coordinates from repo.papermc.io. NeoForge pins come from [maven.neoforged.net](https://maven.neoforged.net/releases).

## Honesty

- Forge, Spigot: no Gradle emission
- NeoForge success is not Forge compatibility
- Paper success is not Spigot compatibility
- Compatibility rows are **not Tested** until a runtime evidence record exists
- `runClient` requires an explicit Minecraft EULA checkbox; CraftStudio never silent-accepts and never distributes game files
- Model output cannot write outside the project or run a shell
- The texture editor does not pretend Ollama painted a PNG

See [PHASE1.md](PHASE1.md), [PHASE2.md](PHASE2.md), [PHASE3.md](PHASE3.md), and [PHASE4.md](PHASE4.md).
