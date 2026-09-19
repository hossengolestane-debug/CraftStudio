# CraftStudio project manifest

Every Phase 1 project is a folder under the configured **projects root**. The folder contains:

```text
<slug>-<shortId>/
  craftstudio.project.json    # required manifest
  README.md                   # generated summary
  snapshots/
    created.manifest.json     # snapshot taken at create time
```

The app never writes outside the projects root. Path segments that traverse (`..`), contain slashes, null bytes, or Windows device names are rejected.

## `craftstudio.project.json`

```json
{
  "id": "11111111-2222-4333-8444-555555555555",
  "name": "River Stones",
  "description": "Adds polished river stones.",
  "type": "mod",
  "platform": "fabric",
  "minecraftVersion": "1.21.1",
  "createdAt": "2026-09-18T12:00:00.000Z",
  "updatedAt": "2026-09-18T12:00:00.000Z",
  "features": {
    "customItems": true,
    "customMobs": false,
    "customGuis": false,
    "customBlocks": false,
    "recipes": false
  },
  "schemaVersion": 1
}
```

| Field | Rules |
| --- | --- |
| `id` | UUID |
| `name` | 1–80 characters |
| `description` | 0–32000 characters (same archive cap as `spec.prompt`; not mid-word sliced) |
| `type` | `mod` or `plugin` |
| `platform` | `fabric` \| `neoforge` \| `forge` for mods; `paper` \| `spigot` for plugins |
| `minecraftVersion` | Must exist in the compatibility registry and not be `unsupported` |
| `createdAt` / `updatedAt` | ISO-8601 UTC |
| `features` | Boolean stubs only in Phase 1 — they do not generate code |
| `schemaVersion` | `1` |

## Autosave and snapshots

- **Create-time snapshot:** a copy of the manifest is written to `snapshots/created.manifest.json` when the project is created. Phase 1 does **not** implement in-session undo.
- **Metadata autosave:** rename, description, and feature-flag edits update `updatedAt` and rewrite the manifest. There is no debounce timer beyond the explicit Save / Rename actions.

## App settings

Stored at `<userData>/settings.json` (not inside a project folder):

```json
{
  "schemaVersion": 1,
  "projectsPath": "/home/you/.config/craftstudio-local/CraftStudioProjects",
  "ollamaEndpoint": "http://localhost:11434",
  "ollamaTimeoutMs": 8000,
  "lastOpenedProjectId": null
}
```

Default projects path is `<userData>/CraftStudioProjects`. `~/CraftStudioProjects` is the documented home alternative and can be chosen in Settings.
