import { defaultPluginGui } from '../../../../shared/defaults'
import type { ProjectSpec, SpecPluginGui } from '../../../../shared/spec'
import { Button, Card, Field, TextInput } from '../../components/ui'

export function PluginGuiEditor({
  spec,
  onChange
}: {
  spec: ProjectSpec
  onChange: (spec: ProjectSpec) => void
}) {
  const update = (index: number, patch: Partial<SpecPluginGui>): void => {
    const pluginGuis = spec.pluginGuis.map((gui, guiIndex) => (guiIndex === index ? { ...gui, ...patch } : gui))
    onChange({ ...spec, pluginGuis, source: 'editor' })
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Plugin inventory menu</h2>
        <p className="mt-1 text-sm text-muted">
          Preview of a chest-style menu. Generated listeners cancel click, drag, and shift-transfer. Pagination
          rebuilds real extra pages when slots overflow the chest (last two slots are Previous / Next). This is not
          a Minecraft-verified GUI.
        </p>
      </div>

      {spec.pluginGuis.map((gui, index) => (
        <div key={`${gui.id}-${index}`} className="space-y-3 border border-line p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Menu id" htmlFor={`plugingui-id-${index}`}>
              <TextInput
                id={`plugingui-id-${index}`}
                value={gui.id}
                onChange={(event) => update(index, { id: event.target.value })}
              />
            </Field>
            <Field label="Title" htmlFor={`plugingui-title-${index}`}>
              <TextInput
                id={`plugingui-title-${index}`}
                value={gui.title}
                maxLength={32}
                onChange={(event) => update(index, { title: event.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={gui.pagination}
                onChange={(event) => update(index, { pagination: event.target.checked })}
              />
              Paginate when slots overflow this chest (Previous / Next on the last row)
            </label>
          </div>
          <div className="border border-dashed border-line bg-[#f7f7f3] p-2">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Preview (not in-game)</p>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', maxWidth: 360 }}
            >
              {Array.from({ length: gui.rows * 9 }, (_, slot) => {
                const filled = gui.slots.find((entry) => entry.index === slot)
                return (
                  <div
                    key={slot}
                    className={`flex aspect-square items-center justify-center border text-[9px] ${
                      filled ? 'border-ink bg-white' : 'border-line bg-[#c6c6c6]'
                    }`}
                    title={filled ? `${filled.label} (${filled.action})` : `empty ${slot}`}
                  >
                    {filled ? filled.label.slice(0, 4) : ''}
                  </div>
                )
              })}
            </div>
          </div>
          <ul className="list-disc pl-5 text-sm">
            {gui.slots.map((slot) => (
              <li key={`${gui.id}-${slot.index}`}>
                Slot {slot.index}: {slot.label} · {slot.action}
                {slot.permission ? ` · perm ${slot.permission}` : ''}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange({
                ...spec,
                pluginGuis: spec.pluginGuis.filter((_, guiIndex) => guiIndex !== index),
                source: 'editor'
              })
            }
          >
            Remove menu
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        disabled={spec.pluginGuis.length >= 4}
        onClick={() =>
          onChange({
            ...spec,
            pluginGuis: [...spec.pluginGuis, defaultPluginGui(`example_menu_${spec.pluginGuis.length + 1}`)],
            source: 'editor'
          })
        }
      >
        Add inventory menu
      </Button>
    </Card>
  )
}
