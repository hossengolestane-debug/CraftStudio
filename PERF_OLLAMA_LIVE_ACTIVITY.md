# 1.0.1 Performance + Live Activity hotfix

This is a hotfix on the existing Phase 10 / 1.0.0 product. It does **not** start a new feature phase. User projects and assets stay in the configured projects folder (including any Legendary Mace project). CraftStudio never deletes that folder during this change.

## Root cause + evidence

Investigation of connection testing, model listing, specification generation, retries, and cancellation found several freeze / unresponsiveness drivers. These are from the code path, not invented GPU traces.

1. **Shared abort controller.** `OllamaService.cancel()` used one `AbortController` for both `/api/tags` checks and `/api/chat` inference. First-run checklist, Settings “Check Ollama”, and Design “List” all called `check()`. A check aborted an in-flight generation (or vice versa), then the next operation could start while Ollama was still loading/unloading weights.
2. **Per-token UI work.** Stream chunks were forwarded as `GENERATION_PROGRESS` and appended to a React list. Combined with full-template `JSON.stringify(fallback)` in the user prompt and unbounded repair dumps of the assistant message, this could hitch the renderer while Ollama also spiked RAM/VRAM.
3. **No inference lock.** A second Generate, palette suggestion, or overlapping check could start another `/api/chat` while the first was still running. Ollama then loaded or swapped models under memory pressure.
4. **High default context/output.** New installs used `num_predict=2048` and `num_ctx=4096`. Existing user settings are preserved; only new installs get 1024 / 2048.
5. **Cancel was incomplete.** `SPEC_CANCEL` only called `ollama.cancel()`. There was no generation request ID, so a late response could still become the working spec. Check cancel and inference cancel were the same method.
6. **No explicit unload / model test.** “Check Ollama” listed models (good: `/api/tags`) but the UI did not separate that from an inference ping. There was no user-triggered unload of the model CraftStudio used.

`check()` was already GET `/api/tags` only. The freeze was not “the connection test secretly ran a huge prompt” — it was overlapping inference, shared abort, huge prompts/repairs, and per-chunk UI updates while Ollama used RAM/VRAM.

## Changed files (high level)

- `src/shared/ollamaLimits.ts`, `src/shared/activity.ts`, `src/shared/types.ts` (settings schema 4), `src/shared/errors.ts`, `src/shared/ipc.ts`
- `src/main/services/ollamaService.ts` — separate check vs inference controllers; one-inference lock; batched stream parse; bounded content; `testModel()`; `unload()`
- `src/main/services/generationService.ts` — `requestId` lock; compact template hint; no full-spec prompt dump; discard late results; no repair after resource exhaustion; activity records
- `src/main/services/activityService.ts`, `src/main/logBatcher.ts`, `src/main/ipc.ts`, `src/main/index.ts`
- `src/main/services/gradleService.ts` — one child process; 200 KB log memory cap
- `src/main/services/settingsService.ts` — `persistFullAiLogs`, `activityRetentionHours`
- Preload + Settings / Design / Test / AppShell Live Activity panel + detached `#/activity` window
- `tests/ollamaService.test.ts`, `tests/perfOllamaActivity.test.ts`
- `package.json` **1.0.1**, this document, README pointers

## Before / after measurements

Test conditions for numbers below: Cloud Agent Linux VM, no local Ollama server, no discrete GPU, no Windows desktop session. **GPU / VRAM / whole-PC hitch timings are NOT RUN.** Do not treat empty cells as zeros.

| Measurement | Before (code / prior session) | After (this hotfix) | Conditions |
| --- | --- | --- | --- |
| Check connection HTTP | GET `/api/tags` | GET `/api/tags` only; 5s cap; does not abort inference | Unit tests PASS |
| Check timeout cap | Settings 1–60s | Still configurable; runtime capped at 5s | Unit tests PASS |
| Default `num_predict` / `num_ctx` (new installs) | 2048 / 4096 | 1024 / 2048 | Settings schema 4 unit test PASS |
| Stream buffer | Unbounded string grow | Cap 262144 chars; reader cancelled in `finally` | Unit test PASS |
| Prompt to Ollama | Full `JSON.stringify(template spec)` | Compact ids (`items=mace;…`) + 1200 char user cap | Unit + code review PASS |
| Repair assistant dump | Full previous output | 8000 char cap; stop on resource exhaustion | Code + unit PASS |
| Concurrent `/api/chat` | Allowed | `INFERENCE_BUSY`; includes Test model | Unit tests PASS |
| Generation progress IPC | Every parsed token | Batched ~80ms; Design list last 20 lines | Code review; desktop NOT RUN |
| Gradle log memory | Unbounded | 200 KB in main; 80 KB in Test UI | Code review; Gradle live NOT RUN |
| Activity memory | n/a | 400 events; coalesced streaming; rotating JSONL | Unit test PASS |
| App RSS during `/api/tags` | Not recorded this session | NOT RUN (no Ollama in VM) | — |
| Ollama RSS / GPU VRAM | User report: spike + brief PC freeze | NOT RUN — do not invent readings | Windows desktop required |
| Typing / scroll during generate | User report: app unresponsive | Batched updates; generate no longer blocks metadata save | Desktop NOT RUN |

## Packaged build notes / Windows launch

Unsigned, as before. After this PR is on the branch, rebuild on the Windows machine from source:

```text
Source tree:  E:\CraftStudio
Launch (existing unsigned build):  E:\CraftStudio Local\CraftStudio Local.exe
```

```bat
cd /d E:\CraftStudio
git pull
npm install
npm test
npm run lint
npm run typecheck
npm run dist:win:portable
```

Copy the new portable exe over `E:\CraftStudio Local\CraftStudio Local.exe` only after you confirm the projects folder path in Settings still points at your existing CraftStudioProjects directory (Legendary Mace and other projects live there, not inside the exe).

Linux / CI packaging is still unsigned. `CRAFTSTUDIO_NO_SANDBOX=1` remains the container launch flag.

Prefer a **small** local model first (`tinyllama`, `llama3.2:1b`, etc.) if you must exercise Ollama. Do not repeatedly reproduce whole-PC freezes.

## Checks

| Check | Result | Notes |
| --- | --- | --- |
| Ollama stopped: connection fails promptly; UI navigable | **NOT RUN** (no desktop + no Ollama in this VM). Logic: `check()` uses GET `/api/tags` with ≤5s abort and returns `connected: false` without hanging the renderer. Unit test covers refused connection. | Windows: stop Ollama, open Settings, Check connection. Expect a fail within ~5s. Switch Projects / Design while it runs. |
| Ollama running: connection check does not load a model | **PASS** in unit tests (only `/api/tags`). Desktop VRAM proof **NOT RUN**. | Windows: note `ollama ps` before/after Check connection. It must not show a newly loaded model. |
| Repeated clicks cannot overlap inference | **PASS** unit (`INFERENCE_BUSY` + Design/Settings click locks). Desktop double-click **NOT RUN**. | Windows: mash Test model / Generate. Second click must refuse or no-op. |
| During generation: typing / scroll / nav / cancel remain usable | **NOT RUN** on desktop. Code: generate busy is local; tabs stay enabled; progress batched; Cancel increments a request token. | Windows: start Generate, type in the prompt, scroll Live Activity, switch Code, press Cancel. |
| Long responses / logs stay within buffer caps | **PASS** unit for stream cap + activity memory. Gradle UI cap **code review only**. | Windows: a long generate/build must show a truncation marker, not unbounded growth. |
| Cancel does not leave stale requests mutating state | **PASS** unit (late `chatJson` resolve discarded; next template generate works). Ollama server-side stop **NOT RUN**. | Limitation: aborting the HTTP request does **not** guarantee Ollama stops GPU work. `ollama ps` may still show the model until Unload or idle. After Cancel, Generate or Test model must work without restarting the app. |
| Live Activity open / close / filter does not duplicate ops | **PASS** by architecture (one main-process bus; windows only subscribe). Desktop **NOT RUN**. | Windows: open panel, open separate window, close both, generate once. One request ID, not two generates. |
| Project save / reopen works | **PASS** existing project/generation pipeline tests (including a Legendary Mace-named Fabric project in the cancel test). Desktop reopen **NOT RUN**. | Windows: save Legendary Mace, quit, reopen. Spec + assets must still be there. |
| Prefer smaller model first | Documented. Live Ollama **NOT RUN** here. | Do not loop large-model freezes to “confirm” the fix. |
| Real request → validation → files → Gradle | Template path **PASS** in existing pipeline tests (Fabric/Paper/NeoForge/Forge apply). Live Ollama spec + live Gradle **NOT RUN** in this hotfix VM. Phase 10 already recorded live Gradle on Fabric (19s) and Forge (8s) for 1.0.0. | Windows: Generate (template or small model) → Review → Apply → Test → Gradle build. Report the real exit code. |
| `npm test` / lint / typecheck / build | **PASS** — 136 tests, eslint clean, `tsc` both projects, `electron-vite build` wrote `out/`. | Cloud VM, 2026-09-18. |

## Remaining limitations (including hardware)

- CraftStudio can abort its HTTP client and ignore late JSON. It cannot force the Ollama daemon or the GPU driver to stop immediately. **Unload model** sends `POST /api/generate` with `keep_alive: 0` for the **selected CraftStudio model only**. Other apps sharing that model may hitch. Unrelated models are not touched. OS VRAM reclaim is best-effort.
- App `num_ctx` / `num_predict` only apply to CraftStudio requests. Other frontends talking to the same Ollama can still exhaust RAM/VRAM.
- Palette suggestion also uses the single inference lock. It will fail with `INFERENCE_BUSY` during generate rather than starting a second load.
- Live Activity records **real** operations only. It does not show fake percentages or invented chain-of-thought. Full prompt persistence is **opt-in** (`persistFullAiLogs`).
- Detached Live Activity is another BrowserWindow on the same bus. It does not spawn extra Ollama or Gradle work.
- Cloud VM: no Ollama, no Windows GPU, no packaged exe launch at `E:\CraftStudio Local\`. Those rows stay NOT RUN until you run the Windows steps above.
- Installers remain unsigned.

## Manual Windows checklist (copy)

1. Confirm Settings → projects folder still points at your existing projects (Legendary Mace).
2. With Ollama **stopped**: Check connection fails in ≤5s; UI stays clickable.
3. Start Ollama. `ollama ps`. Check connection. `ollama ps` again — no new model load.
4. Select a **small** model yourself. Do not let the app pick one.
5. Test model once. Confirm the UI shows that tag plus `num_predict=8`, `num_ctx=512`.
6. Generate a spec. During stream: type, scroll, open Live Activity, Cancel. Start another generate after cancel.
7. Apply files, then Gradle build if JDK 21 is installed. Record the real exit code.
8. Unload model. Confirm the warning. Check `ollama ps`.
9. Export diagnostic log. Confirm it states secrets are redacted and that it does not grant arbitrary command execution.
