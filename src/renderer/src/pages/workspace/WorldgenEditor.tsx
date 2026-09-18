import { defaultWorldgenEntry } from '../../../../shared/editorSpec'
import { SPAWN_BIOMES, WORLDGEN_BLOCKS, type ProjectSpec, type SpecWorldgen } from '../../../../shared/spec'
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

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Worldgen MVP (ore veins)</h2>
        <p className="mt-1 text-sm text-muted">
          Trusted-template ore veins only: configured_feature + placed_feature JSON that place allowlisted vanilla ores.
          Not a dimension or structure stack. Cap: 4 veins.
        </p>
        {pluginLimits ? (
          <p className="mt-2 text-sm">
            Paper and Spigot cannot emit worldgen. Apply will reject ore-vein entries on plugin projects. This is an
            honest gap — no fake ore JSON.
          </p>
        ) : (
          <p className="mt-2 text-sm">
            Fabric adds the placed feature with BiomeModifications. Forge/NeoForge use an add_features biome modifier.
          </p>
        )}
      </div>

      {spec.worldgen.map((entry, index) => (
        <div key={`${entry.id}-${index}`} className="space-y-3 border border-line p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Vein id" htmlFor={`wg-id-${index}`}>
              <TextInput
                id={`wg-id-${index}`}
                value={entry.id}
                maxLength={31}
                onChange={(event) => update(index, { id: event.target.value })}
              />
            </Field>
            <Field label="Vanilla block" htmlFor={`wg-block-${index}`}>
              <select
                id={`wg-block-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={entry.block}
                onChange={(event) => update(index, { block: event.target.value as SpecWorldgen['block'] })}
              >
                {WORLDGEN_BLOCKS.map((block) => (
                  <option key={block} value={block}>
                    {block}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vein size" htmlFor={`wg-size-${index}`}>
              <TextInput
                id={`wg-size-${index}`}
                inputMode="numeric"
                value={String(entry.size)}
                onChange={(event) =>
                  update(index, { size: Math.min(16, Math.max(1, Number(event.target.value) || 9)) })
                }
              />
            </Field>
            <Field label="Count per chunk" htmlFor={`wg-count-${index}`}>
              <TextInput
                id={`wg-count-${index}`}
                inputMode="numeric"
                value={String(entry.count)}
                onChange={(event) =>
                  update(index, { count: Math.min(32, Math.max(1, Number(event.target.value) || 10)) })
                }
              />
            </Field>
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
            Remove vein
          </Button>
        </div>
      ))}

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
    </Card>
  )
}
