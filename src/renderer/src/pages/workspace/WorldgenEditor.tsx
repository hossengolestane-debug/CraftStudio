import { defaultSurfacePatchEntry, defaultWorldgenEntry } from '../../../../shared/editorSpec'
import {
  SPAWN_BIOMES,
  SURFACE_PATCH_BLOCKS,
  WORLDGEN_BLOCKS,
  type ProjectSpec,
  type SpecWorldgen
} from '../../../../shared/spec'
import { Button, Card, Field, TextInput } from '../../components/ui'

export function WorldgenEditor({
  spec,
  onChange,
  pluginLimits
}: {
  spec: ProjectSpec
  onChange: (spec: ProjectSpec) => void
  pluginLimits: boolean
}) {
  const update = (index: number, patch: Partial<SpecWorldgen>): void => {
    const worldgen = spec.worldgen.map((entry, entryIndex) =>
      entryIndex === index ? { ...entry, ...patch } : entry
    )
    onChange({ ...spec, worldgen, source: 'editor' })
  }

  const oreBlocks = [...WORLDGEN_BLOCKS, ...spec.blocks.map((block) => block.id)]
  const patchBlocks = [...SURFACE_PATCH_BLOCKS, ...spec.blocks.map((block) => block.id)]

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Worldgen (ore veins + surface patches)</h2>
        <p className="mt-1 text-sm text-muted">
          Trusted-template features only. ore_vein uses minecraft:ore (vanilla ore or a spec block). surface_patch uses
          minecraft:random_patch. Not a dimension or structure stack. Cap: 4 entries.
        </p>
        {pluginLimits ? (
          <p className="mt-2 text-sm">
            Paper and Spigot cannot emit worldgen. Apply rejects these entries. No fake ore JSON.
          </p>
        ) : (
          <p className="mt-2 text-sm">
            Fabric uses BiomeModifications. Forge/NeoForge use add_features biome modifiers.
          </p>
        )}
      </div>

      {spec.worldgen.map((entry, index) => (
        <div key={`${entry.id}-${index}`} className="space-y-3 border border-line p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Feature id" htmlFor={`wg-id-${index}`}>
              <TextInput
                id={`wg-id-${index}`}
                value={entry.id}
                maxLength={31}
                onChange={(event) => update(index, { id: event.target.value })}
              />
            </Field>
            <Field label="Kind" htmlFor={`wg-kind-${index}`}>
              <select
                id={`wg-kind-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={entry.kind}
                onChange={(event) => {
                  const kind = event.target.value as SpecWorldgen['kind']
                  update(index, {
                    kind,
                    block: kind === 'surface_patch' ? SURFACE_PATCH_BLOCKS[0] : WORLDGEN_BLOCKS[1]
                  })
                }}
              >
                <option value="ore_vein">ore_vein</option>
                <option value="surface_patch">surface_patch</option>
              </select>
            </Field>
            <Field label={entry.kind === 'surface_patch' ? 'Plant / block' : 'Ore / spec block'} htmlFor={`wg-block-${index}`}>
              <select
                id={`wg-block-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={entry.block}
                onChange={(event) => update(index, { block: event.target.value })}
              >
                {(entry.kind === 'surface_patch' ? patchBlocks : oreBlocks).map((block) => (
                  <option key={block} value={block}>
                    {block}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={entry.kind === 'surface_patch' ? 'XZ spread' : 'Vein size'} htmlFor={`wg-size-${index}`}>
              <TextInput
                id={`wg-size-${index}`}
                inputMode="numeric"
                value={String(entry.size)}
                onChange={(event) =>
                  update(index, { size: Math.min(16, Math.max(1, Number(event.target.value) || 9)) })
                }
              />
            </Field>
            <Field label={entry.kind === 'surface_patch' ? 'Tries' : 'Count per chunk'} htmlFor={`wg-count-${index}`}>
              <TextInput
                id={`wg-count-${index}`}
                inputMode="numeric"
                value={String(entry.count)}
                onChange={(event) =>
                  update(index, { count: Math.min(32, Math.max(1, Number(event.target.value) || 10)) })
                }
              />
            </Field>
            {entry.kind === 'ore_vein' ? (
              <>
                <Field label="Min Y" htmlFor={`wg-min-${index}`}>
                  <TextInput
                    id={`wg-min-${index}`}
                    inputMode="numeric"
                    value={String(entry.minY)}
                    onChange={(event) =>
                      update(index, { minY: Math.min(320, Math.max(-64, Number(event.target.value) || -24)) })
                    }
                  />
                </Field>
                <Field label="Max Y" htmlFor={`wg-max-${index}`}>
                  <TextInput
                    id={`wg-max-${index}`}
                    inputMode="numeric"
                    value={String(entry.maxY)}
                    onChange={(event) =>
                      update(index, { maxY: Math.min(320, Math.max(-64, Number(event.target.value) || 56)) })
                    }
                  />
                </Field>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {SPAWN_BIOMES.map((biome) => (
              <label key={biome} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={entry.biomes.includes(biome)}
                  onChange={(event) => {
                    const biomes = event.target.checked
                      ? [...entry.biomes, biome]
                      : entry.biomes.filter((item) => item !== biome)
                    update(index, { biomes })
                  }}
                />
                {biome}
              </label>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange({
                ...spec,
                worldgen: spec.worldgen.filter((_, entryIndex) => entryIndex !== index),
                source: 'editor'
              })
            }
          >
            Remove feature
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={spec.worldgen.length >= 4}
          onClick={() =>
            onChange({
              ...spec,
              worldgen: [...spec.worldgen, defaultWorldgenEntry(`ore_vein_${spec.worldgen.length + 1}`)],
              source: 'editor'
            })
          }
        >
          Add ore vein
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={spec.worldgen.length >= 4}
          onClick={() =>
            onChange({
              ...spec,
              worldgen: [...spec.worldgen, defaultSurfacePatchEntry(`flower_patch_${spec.worldgen.length + 1}`)],
              source: 'editor'
            })
          }
        >
          Add surface patch
        </Button>
      </div>
    </Card>
  )
}
