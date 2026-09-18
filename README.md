# CraftStudio Local

Desktop app that helps beginners create **Minecraft Java Edition** mods and server plugins using **local Ollama**.

| Mods | Plugins |
| --- | --- |
| Fabric, NeoForge, Forge | Paper, Spigot |

**Phase 5** is implemented: widened NeoForge 1.21.x pins, a real **Forge 1.21.1** Gradle slice, a careful **Spigot** emitter (not copied from Paper), preset custom mobs, first-slice GUI designers, richer item models + `pack.png`, and recoverable snapshots before apply / version change. A compile-only Gradle build never flips **Tested**.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+
- JDK 21 on PATH to run `./gradlew build` (generation still works without it)
- Windows, macOS, or Linux (docs are Windows-first; the code is portable)

Optional: [Ollama](https://ollama.com) at `http://localhost:11434` for requests templates cannot express. Simple items, preset mobs, and simple GUIs generate **without** Ollama. Ollama may also suggest a texture palette — it does not draw PNGs.

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

## Vertical slice (Phase 5)

1. Create **Fabric** 1.21.x, **Paper** 1.21.x, **NeoForge** 1.21.1 / 1.21.4 / 1.21.8, **Forge 1.21.1**, or **Spigot** 1.21 / 1.21.1 / 1.21.4.
2. Open **Design**. Edit items, a preset mob, and a simple GUI. Generate a spec (templates first).
3. **Review file changes**, then **Apply files**. A snapshot is written first.
4. Change Minecraft version only after **Assess change** lists incompatible features. A snapshot is written first.
5. Open **Assets**. Paint or import a 16×16 / 32×32 PNG. Models may be `generated` or `handheld`, with optional `layer1`.
6. Open **Export** for a source ZIP, a built JAR after `./gradlew build`, or a resource pack that includes `pack.png`.
7. Open **Test** for a real Gradle compile. Runtime verification (and Tested) is a separate, evidence-gated step.

Fabric 1.21 / 1.21.1 uses classic `Registry.register`. Fabric 1.21.2+ uses `Items.register` + `RegistryKey`. NeoForge uses `DeferredRegister.Items` and is **not** Forge. Forge 1.21.1 uses ForgeGradle 6 + `mods.toml` `mandatory=true`. Paper items are vanilla `Material.PAPER` + PDC + CustomModelData. Spigot uses `org.spigotmc:spigot-api` and legacy `setDisplayName` — **Paper APIs are not copied**. Plugin mobs are **vanilla disguises**, not new client entity types.

Ollama may only propose spec JSON (or a color palette). That JSON is independently validated. **Nothing is written from unvalidated model text.** Java and Gradle stay template-authored.

## Architecture

```text
src/main/          Electron main (projects, Ollama, generation, Gradle, export, textures, evidence, snapshots)
src/main/codegen/  Fabric + Paper + NeoForge + Forge + Spigot templates + vendored Gradle wrapper
src/preload/       Restricted contextBridge
src/renderer/      React UI (item / mob / GUI editors, Monaco, texture editor)
src/shared/        Manifest, Zod spec, adapters, compatibility, pins, PNG, evidence, migration
```

Pinned app stack: Electron 39, electron-vite 5, Vite 7, React 19, TypeScript 5.9, Tailwind 4, Zod 3, Vitest 3, Monaco 0.52.

Fabric pins come from [fabricmc.net/develop](https://fabricmc.net/develop/) / Fabric Meta. Paper pins use official `paper-api` coordinates from repo.papermc.io. NeoForge pins come from [maven.neoforged.net](https://maven.neoforged.net/releases). Forge pins come from [maven.minecraftforge.net](https://maven.minecraftforge.net/). Spigot pins use `hub.spigotmc.org` snapshots.

## Honesty

- NeoForge success is not Forge compatibility
- Paper success is not Spigot compatibility
- Plugin custom mobs are vanilla disguises; they are not new client entity types
- GUI designers are labeled **preview**; they are not Minecraft-verified UIs
- Compatibility rows are **not Tested** until a runtime evidence record exists
- `runClient` requires an explicit Minecraft EULA checkbox; CraftStudio never silent-accepts and never distributes game files
- Model output cannot write outside the project or run a shell
- The texture editor does not pretend Ollama painted a PNG

See [PHASE1.md](PHASE1.md), [PHASE2.md](PHASE2.md), [PHASE3.md](PHASE3.md), [PHASE4.md](PHASE4.md), and [PHASE5.md](PHASE5.md).
