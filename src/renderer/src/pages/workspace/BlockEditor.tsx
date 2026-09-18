import { defaultSpecBlock } from '../../../../shared/editorSpec'
import { BLOCK_ENTRY_CAP, BLOCK_MATERIALS, VANILLA_ITEMS, type ProjectSpec, type SpecBlock } from '../../../../shared/spec'
import { Button, Card, Field, TextInput } from '../../components/ui'

export function BlockEditor({
  spec,
  onChange,
  pluginLimits
}: {
  spec: ProjectSpec
  onChange: (spec: ProjectSpec) => void
  pluginLimits: boolean
}) {
  const update = (index: number, patch: Partial<SpecBlock>): void => {
    const blocks = spec.blocks.map((block, blockIndex) => (blockIndex === index ? { ...block, ...patch } : block))
    onChange({ ...spec, blocks, source: 'editor' })
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Custom blocks</h2>
        <p className="mt-1 text-sm text-muted">
          Cube-all blocks with a BlockItem, blockstate, model, and loot table. Cap: {BLOCK_ENTRY_CAP}. Paint the texture
          in Assets. Ore veins can place a spec block.
        </p>
        {pluginLimits ? (
          <p className="mt-2 text-sm">
            Paper and Spigot cannot register a new block id. Apply rejects block entries. This is not a vanilla-block
            disguise.
          </p>
        ) : (
          <p className="mt-2 text-sm">
            Fabric, Forge, and NeoForge emit real block registration. Not a multipart blockstate or inventory API.
          </p>
        )}
      </div>

      {spec.blocks.map((block, index) => (
        <div key={`${block.id}-${index}`} className="space-y-3 border border-line p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Display name" htmlFor={`block-name-${index}`}>
              <TextInput
                id={`block-name-${index}`}
                value={block.displayName}
                maxLength={80}
                onChange={(event) => update(index, { displayName: event.target.value })}
              />
            </Field>
            <Field label="Identifier" htmlFor={`block-id-${index}`}>
              <TextInput
                id={`block-id-${index}`}
                value={block.id}
                maxLength={31}
                onChange={(event) => update(index, { id: event.target.value })}
              />
            </Field>
            <Field label="Material / sound" htmlFor={`block-mat-${index}`}>
              <select
                id={`block-mat-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={block.material}
                onChange={(event) => update(index, { material: event.target.value as SpecBlock['material'] })}
              >
                {BLOCK_MATERIALS.map((material) => (
                  <option key={material} value={material}>
                    {material}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Drop" htmlFor={`block-drop-${index}`} hint="self drops the BlockItem.">
              <select
                id={`block-drop-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={block.dropItem}
                onChange={(event) => update(index, { dropItem: event.target.value })}
              >
                <option value="self">self</option>
                {spec.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id}
                  </option>
                ))}
                {VANILLA_ITEMS.slice(0, 12).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hardness" htmlFor={`block-hard-${index}`}>
              <TextInput
                id={`block-hard-${index}`}
                inputMode="decimal"
                value={String(block.hardness)}
                onChange={(event) =>
                  update(index, { hardness: Math.min(50, Math.max(0.1, Number(event.target.value) || 1.5)) })
                }
              />
            </Field>
            <Field label="Resistance" htmlFor={`block-res-${index}`}>
              <TextInput
                id={`block-res-${index}`}
                inputMode="decimal"
                value={String(block.resistance)}
                onChange={(event) =>
                  update(index, { resistance: Math.min(1200, Math.max(0, Number(event.target.value) || 6)) })
                }
              />
            </Field>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange({
                ...spec,
                blocks: spec.blocks.filter((_, blockIndex) => blockIndex !== index),
                source: 'editor'
              })
            }
          >
            Remove block
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        disabled={spec.blocks.length >= BLOCK_ENTRY_CAP}
        onClick={() =>
          onChange({
            ...spec,
            blocks: [...spec.blocks, defaultSpecBlock(`custom_block_${spec.blocks.length + 1}`)],
            source: 'editor'
          })
        }
      >
        Add block
      </Button>
    </Card>
  )
}
