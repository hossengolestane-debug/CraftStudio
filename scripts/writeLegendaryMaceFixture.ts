import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderWeaponTexture } from '../src/main/codegen/textures/proceduralWeapon'
import { parseProjectSpec } from '../src/shared/spec'
import { inferSpecFromPrompt } from '../src/shared/templateInfer'
import { MANIFEST_SCHEMA_VERSION, type ProjectManifest } from '../src/shared/types'
import { LEGENDARY_MACE_REQUEST } from '../tests/fixtures/legendaryMaceRequest'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const manifest: ProjectManifest = {
  id: 'cccccccc-1111-4222-8333-444444444444',
  name: 'Legendary Mace',
  description: 'Legendary Mace',
  type: 'mod',
  platform: 'forge',
  minecraftVersion: '1.21.1',
  createdAt: '2026-09-18T08:00:00.000Z',
  updatedAt: '2026-09-18T08:00:00.000Z',
  features: {
    customItems: true,
    customMobs: false,
    customGuis: false,
    customBlocks: false,
    recipes: true
  },
  schemaVersion: MANIFEST_SCHEMA_VERSION
}

const spec = parseProjectSpec(inferSpecFromPrompt(manifest, LEGENDARY_MACE_REQUEST))
const json = `${JSON.stringify(spec, null, 2)}\n`
const png = renderWeaponTexture(spec.items[0]!)

await mkdir(path.join(root, 'tests/fixtures'), { recursive: true })
await writeFile(path.join(root, 'tests/fixtures/legendaryMace.craftstudio.spec.json'), json)
await writeFile(path.join(root, 'LEGENDARY_MACE_SPEC.json'), json)
await writeFile(path.join(root, 'tests/fixtures/legendary_mace.png'), png)
console.log(`wrote spec ${json.length} bytes, png ${png.byteLength} bytes`)
