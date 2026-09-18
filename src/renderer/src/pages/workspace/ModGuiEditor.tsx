import { defaultModGui } from '../../../../shared/defaults'
import type { ProjectSpec, SpecModGui } from '../../../../shared/spec'
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
            Fabric, Forge 1.21.1, and NeoForge emit a Screen + Menu/ScreenHandler pair for the first screen. Client
            clicks are untrusted; the server menu validates slots. This preview is not Minecraft-verified.
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
