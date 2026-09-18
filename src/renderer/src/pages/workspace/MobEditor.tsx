import { defaultMob } from '../../../../shared/defaults'
import { MOB_PRESETS, SPAWN_BIOMES, VANILLA_MOB_BASES, type ProjectSpec, type SpecMob } from '../../../../shared/spec'
import { Button, Card, Field, TextInput } from '../../components/ui'

export function MobEditor({
  spec,
  onChange,
  pluginLimits
}: {
  spec: ProjectSpec
  onChange: (spec: ProjectSpec) => void
  pluginLimits: boolean
}) {
  const update = (index: number, patch: Partial<SpecMob>): void => {
    const mobs = spec.mobs.map((mob, mobIndex) => (mobIndex === index ? { ...mob, ...patch } : mob))
    onChange({ ...spec, mobs, source: 'editor' })
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Custom mobs</h2>
        <p className="mt-1 text-sm text-muted">
          Phase 7 emits five movement presets (not a behavior tree) plus an optional biome spawn table.
          Java stays template-authored.
        </p>
        {pluginLimits ? (
          <p className="mt-2 text-sm">
            Plugins cannot register a new client entity type. Generated code disguises a vanilla zombie, pig, or wolf
            (name, health, PDC). Players still see that vanilla model unless they install a resource pack that restyles
            it.
          </p>
        ) : (
          <p className="mt-2 text-sm">
            Mods register a real entity type and a compiling visible cube renderer (classic on Fabric 1.21/1.21.1,
            render-state on Fabric 1.21.2+ and NeoForge 1.21.4+). This is not a Minecraft-verified custom model.
          </p>
        )}
      </div>

      {spec.mobs.map((mob, index) => (
        <div key={`${mob.id}-${index}`} className="space-y-3 border border-line p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Display name" htmlFor={`mob-name-${index}`}>
              <TextInput
                id={`mob-name-${index}`}
                value={mob.displayName}
                maxLength={80}
                onChange={(event) => update(index, { displayName: event.target.value })}
              />
            </Field>
            <Field label="Identifier" htmlFor={`mob-id-${index}`}>
              <TextInput
                id={`mob-id-${index}`}
                value={mob.id}
                maxLength={31}
                onChange={(event) => update(index, { id: event.target.value })}
              />
            </Field>
            <Field label="Health" htmlFor={`mob-health-${index}`}>
              <TextInput
                id={`mob-health-${index}`}
                inputMode="decimal"
                value={String(mob.health)}
                onChange={(event) => update(index, { health: Math.min(200, Math.max(1, Number(event.target.value) || 1)) })}
              />
            </Field>
            <Field label="Movement speed" htmlFor={`mob-speed-${index}`}>
              <TextInput
                id={`mob-speed-${index}`}
                inputMode="decimal"
                value={String(mob.movementSpeed)}
                onChange={(event) =>
                  update(index, { movementSpeed: Math.min(1, Math.max(0.05, Number(event.target.value) || 0.25)) })
                }
              />
            </Field>
            <Field label="Attack damage" htmlFor={`mob-atk-${index}`}>
              <TextInput
                id={`mob-atk-${index}`}
                inputMode="decimal"
                value={String(mob.attackDamage)}
                onChange={(event) =>
                  update(index, { attackDamage: Math.min(40, Math.max(0, Number(event.target.value) || 0)) })
                }
              />
            </Field>
            <Field label="Behavior preset" htmlFor={`mob-preset-${index}`}>
              <select
                id={`mob-preset-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={mob.preset}
                onChange={(event) => update(index, { preset: event.target.value as SpecMob['preset'] })}
              >
                {MOB_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Targeting" htmlFor={`mob-target-${index}`}>
              <select
                id={`mob-target-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={mob.targeting}
                onChange={(event) => update(index, { targeting: event.target.value as SpecMob['targeting'] })}
              >
                <option value="none">none</option>
                <option value="players">players</option>
                <option value="hostiles">hostiles</option>
              </select>
            </Field>
            <Field label="Vanilla disguise / model ref" htmlFor={`mob-base-${index}`}>
              <select
                id={`mob-base-${index}`}
                className="w-full border border-line bg-white px-3 py-2"
                value={mob.appearance.vanillaBase}
                onChange={(event) =>
                  update(index, {
                    appearance: {
                      ...mob.appearance,
                      vanillaBase: event.target.value as SpecMob['appearance']['vanillaBase']
                    }
                  })
                }
              >
                {VANILLA_MOB_BASES.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="space-y-2 border border-dashed border-line p-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mob.spawn.enabled}
                disabled={pluginLimits}
                onChange={(event) =>
                  update(index, { spawn: { ...mob.spawn, enabled: event.target.checked } })
                }
              />
              Enable biome spawn table
            </label>
            {pluginLimits ? (
              <p className="text-xs text-muted">
                Paper/Spigot cannot register biome spawn tables. Disguises stay summon/command only.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted">
                  Allowlisted biomes only. This is not a worldgen stack. {mob.spawnStub}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SPAWN_BIOMES.map((biome) => (
                    <label key={biome} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={mob.spawn.biomes.includes(biome)}
                        onChange={(event) => {
                          const biomes = event.target.checked
                            ? [...mob.spawn.biomes, biome]
                            : mob.spawn.biomes.filter((entry) => entry !== biome)
                          update(index, { spawn: { ...mob.spawn, biomes } })
                        }}
                      />
                      {biome}
                    </label>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <Field label="Weight" htmlFor={`mob-spawn-w-${index}`}>
                    <TextInput
                      id={`mob-spawn-w-${index}`}
                      inputMode="numeric"
                      value={String(mob.spawn.weight)}
                      onChange={(event) =>
                        update(index, {
                          spawn: {
                            ...mob.spawn,
                            weight: Math.min(100, Math.max(1, Number(event.target.value) || 8))
                          }
                        })
                      }
                    />
                  </Field>
                  <Field label="Min group" htmlFor={`mob-spawn-min-${index}`}>
                    <TextInput
                      id={`mob-spawn-min-${index}`}
                      inputMode="numeric"
                      value={String(mob.spawn.minGroup)}
                      onChange={(event) =>
                        update(index, {
                          spawn: {
                            ...mob.spawn,
                            minGroup: Math.min(8, Math.max(1, Number(event.target.value) || 1))
                          }
                        })
                      }
                    />
                  </Field>
                  <Field label="Max group" htmlFor={`mob-spawn-max-${index}`}>
                    <TextInput
                      id={`mob-spawn-max-${index}`}
                      inputMode="numeric"
                      value={String(mob.spawn.maxGroup)}
                      onChange={(event) =>
                        update(index, {
                          spawn: {
                            ...mob.spawn,
                            maxGroup: Math.min(8, Math.max(1, Number(event.target.value) || 2))
                          }
                        })
                      }
                    />
                  </Field>
                </div>
              </>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onChange({
                ...spec,
                mobs: spec.mobs.filter((_, mobIndex) => mobIndex !== index),
                source: 'editor'
              })
            }
          >
            Remove mob
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        disabled={spec.mobs.length >= 4}
        onClick={() =>
          onChange({
            ...spec,
            mobs: [...spec.mobs, defaultMob(`custom_mob_${spec.mobs.length + 1}`)],
            source: 'editor'
          })
        }
      >
        Add preset mob
      </Button>
    </Card>
  )
}
