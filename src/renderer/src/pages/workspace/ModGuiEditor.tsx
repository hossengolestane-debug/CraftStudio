import { defaultModGui } from '../../../../shared/defaults'
import { VANILLA_ITEMS, type ProjectSpec, type SpecModGui } from '../../../../shared/spec'
import { Button, Card, Field, TextInput } from '../../components/ui'

export function ModGuiEditor({
  spec,
  onChange,
  menuEmission
}: {
  spec: ProjectSpec
  onChange: (spec: ProjectSpec) => void
  menuEmission: boolean
}) {
  const update = (index: number, patch: Partial<SpecModGui>): void => {
    const modGuis = spec.modGuis.map((gui, guiIndex) => (guiIndex === index ? { ...gui, ...patch } : gui))
    onChange({ ...spec, modGuis, source: 'editor' })
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Mod GUI designer</h2>
        <p className="mt-1 text-sm text-muted">
          Layout preview only — not a Minecraft-verified screen. Generated comments require server-side slot validation
          and do not trust client clicks.
        </p>
        {menuEmission ? (
          <p className="text-sm">
            Fabric, Forge 1.21.1, and NeoForge emit a Screen + Menu/ScreenHandler pair for every screen in this
            project. Client clicks are untrusted. Data slots sync server-owned numbers; ghost items are display-only.
          </p>
        ) : (
          <p className="text-sm">This adapter does not emit a container menu. Layouts stay labeled preview.</p>
        )}
      </div>

      {spec.modGuis.map((gui, index) => (
        <div key={`${gui.id}-${index}`} className="space-y-3 border border-line p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Screen id" htmlFor={`modgui-id-${index}`}>
              <TextInput
                id={`modgui-id-${index}`}
                value={gui.id}
                onChange={(event) => update(index, { id: event.target.value })}
              />
            </Field>
            <Field label="Title" htmlFor={`modgui-title-${index}`}>
              <TextInput
                id={`modgui-title-${index}`}
                value={gui.title}
                onChange={(event) => update(index, { title: event.target.value })}
              />
            </Field>
          </div>
          <div className="border border-dashed border-line bg-[#f7f7f3] p-2">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Preview (not in-game)</p>
            <div
              className="relative bg-[#c6c6c6]"
              style={{ width: Math.min(gui.width, 320), height: Math.min(gui.height, 220) }}
            >
              {gui.widgets.map((widget) => (
                <div
                  key={widget.id}
                  className="absolute overflow-hidden border border-ink/40 bg-white/80 text-[10px]"
                  style={{
                    left: widget.x * (Math.min(gui.width, 320) / gui.width),
                    top: widget.y * (Math.min(gui.height, 220) / gui.height),
                    width: Math.max(12, widget.width * (Math.min(gui.width, 320) / gui.width)),
                    height: Math.max(10, widget.height * (Math.min(gui.height, 220) / gui.height))
                  }}
                >
                  {widget.kind}: {widget.text || widget.id}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 border border-dashed border-line p-2">
            <p className="text-xs text-muted">Data slots (max 4). Server authoritative. Optional ghost item when the first slot is empty.</p>
            {gui.dataSlots.map((slot, slotIndex) => (
              <div key={`${slot.id}-${slotIndex}`} className="grid gap-2 md:grid-cols-3">
                <TextInput
                  value={slot.id}
                  onChange={(event) => {
                    const dataSlots = gui.dataSlots.map((entry, i) =>
                      i === slotIndex ? { ...entry, id: event.target.value } : entry
                    )
                    update(index, { dataSlots })
                  }}
                />
                <TextInput
                  inputMode="numeric"
                  value={String(slot.initial)}
                  onChange={(event) => {
                    const dataSlots = gui.dataSlots.map((entry, i) =>
                      i === slotIndex
                        ? { ...entry, initial: Math.min(32767, Math.max(0, Number(event.target.value) || 0)) }
                        : entry
                    )
                    update(index, { dataSlots })
                  }}
                />
                <select
                  className="border border-line bg-white px-2 py-1"
                  value={slot.ghostItemId ?? ''}
                  onChange={(event) => {
                    const dataSlots = gui.dataSlots.map((entry, i) =>
                      i === slotIndex
                        ? { ...entry, ghostItemId: event.target.value || undefined }
                        : entry
                    )
                    update(index, { dataSlots })
                  }}
                >
                  <option value="">No ghost item</option>
                  {VANILLA_ITEMS.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                  {spec.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={gui.dataSlots.length >= 4}
              onClick={() =>
                update(index, {
                  dataSlots: [
                    ...gui.dataSlots,
                    { id: `data_${gui.dataSlots.length + 1}`, initial: 0, ghostItemId: 'minecraft:iron_ingot' }
                  ]
                })
              }
            >
              Add data slot
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange({
                ...spec,
                modGuis: spec.modGuis.filter((_, guiIndex) => guiIndex !== index),
                source: 'editor'
              })
            }
          >
            Remove screen
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        disabled={spec.modGuis.length >= 4}
        onClick={() =>
          onChange({
            ...spec,
            modGuis: [...spec.modGuis, defaultModGui(`example_screen_${spec.modGuis.length + 1}`)],
            source: 'editor'
          })
        }
      >
        Add mod screen
      </Button>
    </Card>
  )
}
