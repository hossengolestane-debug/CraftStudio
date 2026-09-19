# 1.0.4 Ollama HTTP 400 / grammar hotfix

Do **not** merge this as a feature drop. This hotfix makes specification generation usable against local Ollama + `qwen2.5-coder:7b`. Phases 1–10 and 1.0.1–1.0.3 stay in place.

## Root cause (user machine evidence)

Live Activity / `settingsSnap` used `format: 'craftstudio-spec-json-schema'` as a **label only**. The real POST body sent `format: OLLAMA_SPEC_JSON_SCHEMA` (object).

Sending the literal string `"craftstudio-spec-json-schema"` to Ollama returns HTTP **500**: `invalid format; expected "json" or a valid JSON Schema object`. That is **not** the ~80ms failure the user hit.

The user’s failure was HTTP **400** with:

`Failed to initialize samplers: failed to parse grammar` (`invalid_request_error`)

Bisect on the same machine/model:

- Minimal schemas work.
- Core items/recipes/commands/mobs/blocks work.
- Isolated: `{ type: 'string', maxLength: 2000 }` as `description` → **GRAMMAR_FAIL / HTTP 400**.
- `maxLength` 80…1999 OK; **exactly 2000 FAIL**; 2001 and 4000 OK (Ollama grammar edge case).
- Full `OLLAMA_SPEC_JSON_SCHEMA` had `description: { type: 'string', maxLength: 2000 }`. That alone made the full schema unusable.
- Replacing only that 2000 with **1999** made the **full schema** return HTTP **200** on the same machine/model.

On that 400, generation fell through to “Ollama unavailable. Keeping the trusted template spec.” That is wrong: HTTP 400 is request rejection, not an unreachable server.

## Changes

1. **Ollama-safe schema projection.** `buildOllamaSpecJsonSchema` remaps `maxLength === 2000` → **1999**. Zod still allows 2000-character descriptions. No other Ollama schema field uses `maxLength: 2000`. Empty `{ type: 'object' }` GUI/config nodes now have explicit `properties`.
2. **Do not** downgrade generation to unconstrained `format: 'json'`. The chat body still sends the full spec schema object (attributes/recipes/commands/unsupportedRequests intact).
3. **Wire-format diagnostics.** Activity records `{ kind: 'json_schema', schemaId: 'craftstudio-spec-v1', schemaBytes }` of the object actually sent — not the label string.
4. **HTTP errors.** Non-2xx `/api/chat` reads a bounded redacted body. 4xx / grammar / invalid-format map to `OLLAMA_REQUEST_REJECTED` with `httpStatus`. Connection failures stay `OLLAMA_UNAVAILABLE`. Timeouts and cancels stay distinct. Spec validation after HTTP 200 stays `SPEC_INVALID` / repair.
5. **No template-as-AI-success on rejection.** HTTP 400 throws. The trusted template is not returned as a successful generate. Use template-only mode when you want that spec.
6. **Options.** `/api/chat` still sends `options.num_ctx` and `options.num_predict`. Tests assert the serialized body.

## Checks

| Check | Result |
| --- | --- |
| Serialized `/api/chat` `format` is an object, not the label string | **PASS** (unit) |
| Ollama schema has no `maxLength: 2000`; description is 1999 | **PASS** (unit) |
| Zod still accepts description length 2000 | **PASS** (unit) |
| HTTP 400 grammar body → `OLLAMA_REQUEST_REJECTED`, not unavailable / template success | **PASS** (unit) |
| `options.num_ctx` / `options.num_predict` on the wire | **PASS** (unit) |
| `npm test` / lint / typecheck / `electron-vite build` | **PASS** — 149 tests, eslint clean, `tsc` both projects, `electron-vite build` wrote `out/` and `out/build-info.json` (1.0.4) |
| Live Ollama `qwen2.5-coder:7b` generate HTTP 200 | **NOT RUN** on the cloud VM (no Ollama/GPU) |
| Minecraft client | **NOT RUN** |

## Windows live check (NOT RUN here)

Prefer **`qwen2.5-coder:7b`**.

1. Rebuild. Install into **`E:\CraftStudio Local 1.0.4\`**. Keep older version folders and the existing projects directory.
2. Quit every CraftStudio window. Launch the 1.0.4 exe. Settings → About must show **1.0.4**.
3. Settings → Check connection (`/api/tags` only). Select `qwen2.5-coder:7b`.
4. Generate a spec (Legendary Mace or a simple item). Live Activity must show `format={kind:json_schema, schemaId:craftstudio-spec-v1, schemaBytes:…}` and **HTTP 200**, not HTTP 400 grammar failure.
5. If Ollama still returns 400, Activity must show HTTP 400 + server text. The UI must **not** present a trusted template as the AI result.

## Packaged build

Version is **1.0.4**. After rebuild, copy into `E:\CraftStudio Local 1.0.4\`. Do not delete `E:\CraftStudio Local 1.0.3\` or project folders.
