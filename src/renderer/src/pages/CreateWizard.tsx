import { useMemo, useState } from 'react'
import type { AppErrorPayload } from '../../../shared/errors'
import type {
  CompatibilityEntry,
  CompatibilityStatus,
  PlatformAdapterInfo,
  PlatformId,
  ProjectKind,
  ProjectRecord
} from '../../../shared/types'
import { ErrorPanel } from '../components/ErrorPanel'
import { Badge, Button, Card, ChoiceButton, Field, TextArea, TextInput } from '../components/ui'
import { asAppError } from '../lib/errors'

const STEPS = [
  'Project type',
  'Platform & version',
  'Describe',
  'Review',
  'Build / Test & Export'
] as const

function badgeTone(status: CompatibilityStatus): 'ok' | 'warn' | 'danger' {
  if (status === 'tested') return 'ok'
  if (status === 'experimental') return 'warn'
  return 'danger'
}

function statusLabel(status: CompatibilityStatus): string {
  if (status === 'tested') return 'Tested'
  if (status === 'experimental') return 'Experimental'
  return 'Unsupported'
}

export function CreateWizard({
  adapters,
  onCreated,
  onOpenCreated
}: {
  adapters: PlatformAdapterInfo[]
  onCreated: (input: {
    name: string
    description: string
    type: ProjectKind
    platform: PlatformId
    minecraftVersion: string
  }) => Promise<ProjectRecord>
  onOpenCreated: (record: ProjectRecord) => void
}) {
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<ProjectKind | null>(null)
  const [platform, setPlatform] = useState<PlatformId | null>(null)
  const [minecraftVersion, setMinecraftVersion] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [created, setCreated] = useState<ProjectRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AppErrorPayload | null>(null)

  const kindAdapters = useMemo(
    () => adapters.filter((adapter) => (kind ? adapter.kind === kind : false)),
    [adapters, kind]
  )

  const selectedAdapter = kindAdapters.find((adapter) => adapter.id === platform) ?? null
  const versions: CompatibilityEntry[] = selectedAdapter?.compatibility ?? []
  const selectedCompat = versions.find((entry) => entry.minecraftVersion === minecraftVersion) ?? null
  const canUseVersion = selectedCompat?.status === 'experimental' || selectedCompat?.status === 'tested'

  const canContinue = [
    kind !== null,
    platform !== null && canUseVersion,
    name.trim().length > 0,
    true,
    Boolean(created)
  ][step]

  const primaryLabel = ['Continue', 'Continue', 'Continue', 'Create project', 'Open in Design'][step]

  const resetAfterTypeChange = (next: ProjectKind): void => {
    setKind(next)
    setPlatform(null)
    setMinecraftVersion(null)
  }

  const goNext = async (): Promise<void> => {
    setError(null)
    if (step === 3) {
      if (!kind || !platform || !minecraftVersion) {
        return
      }
      setBusy(true)
      try {
        const record = await onCreated({
          name: name.trim(),
          description: description.trim(),
          type: kind,
          platform,
          minecraftVersion
        })
        setCreated(record)
        setStep(4)
      } catch (err) {
        setError(asAppError(err))
      } finally {
        setBusy(false)
      }
      return
    }
    if (step === 4 && created) {
      onOpenCreated(created)
      return
    }
    setStep((value) => Math.min(value + 1, STEPS.length - 1))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Create</h1>
        <p className="mt-1 text-muted">Progressive wizard. Finish writes a real project folder, then opens it.</p>
      </div>

      <ol className="grid grid-cols-5 gap-2 text-sm" aria-label="Wizard steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? 'step' : undefined}
            className={`border px-2 py-2 ${index === step ? 'border-ink bg-[#ecece8] font-semibold' : 'border-line text-muted'}`}
          >
            <span className="block text-xs">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}

      {step === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">What are you making?</h2>
          <ChoiceButton
            selected={kind === 'mod'}
            title="Minecraft mod"
            description="Client/server content via Fabric, NeoForge, or Forge. Custom entities and textures are possible later."
            onClick={() => resetAfterTypeChange('mod')}
          />
          <ChoiceButton
            selected={kind === 'plugin'}
            title="Server plugin"
            description="Paper or Spigot. Commands and inventories yes; arbitrary new client entities are not possible."
            onClick={() => resetAfterTypeChange('plugin')}
          />
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Platform and Minecraft version</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {kindAdapters.map((adapter) => (
              <ChoiceButton
                key={adapter.id}
                selected={platform === adapter.id}
                title={adapter.displayName}
                description={`${adapter.javaRequirements.notes}`}
                onClick={() => {
                  setPlatform(adapter.id)
                  setMinecraftVersion(null)
                }}
              />
            ))}
          </div>
          {selectedAdapter ? (
            <div className="space-y-2">
              <p className="font-medium">Minecraft versions from the compatibility registry</p>
              <div className="grid gap-2">
                {versions.map((entry) => (
                  <ChoiceButton
                    key={entry.minecraftVersion}
                    selected={minecraftVersion === entry.minecraftVersion}
                    disabled={entry.status === 'unsupported'}
                    title={entry.minecraftVersion}
                    description={entry.notes}
                    badge={<Badge tone={badgeTone(entry.status)}>{statusLabel(entry.status)}</Badge>}
                    onClick={() => setMinecraftVersion(entry.minecraftVersion)}
                  />
                ))}
              </div>
              <p className="text-sm text-muted">
                Nothing is marked Tested in Phase 1 — no Minecraft build was run. Unsupported versions cannot be
                selected.
              </p>
              {selectedAdapter.capabilities.clientEntities === 'unsupported' ? (
                <p className="text-sm">
                  Capability note: {selectedAdapter.displayName} cannot add arbitrary new client-side entities.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted">Choose a platform to see versions.</p>
          )}
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Describe the project</h2>
          <Field label="Name" htmlFor="project-name" hint="Used as the display name and folder slug.">
            <TextInput
              id="project-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Description" htmlFor="project-description" hint="Optional. Saved in the manifest.">
            <TextArea
              id="project-description"
              rows={5}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">Review</h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
            <dt className="text-muted">Type</dt>
            <dd>{kind}</dd>
            <dt className="text-muted">Platform</dt>
            <dd>{selectedAdapter?.displayName}</dd>
            <dt className="text-muted">Minecraft</dt>
            <dd>
              {minecraftVersion}{' '}
              {selectedCompat ? (
                <Badge tone={badgeTone(selectedCompat.status)}>{statusLabel(selectedCompat.status)}</Badge>
              ) : null}
            </dd>
            <dt className="text-muted">Name</dt>
            <dd>{name.trim()}</dd>
            <dt className="text-muted">Description</dt>
            <dd>{description.trim() || '—'}</dd>
          </dl>
          <p className="text-sm text-muted">
            Create writes `craftstudio.project.json`, a README, and a create-time snapshot. Open Design next to
            generate a Fabric Gradle project from a validated spec (1.21 / 1.21.1).
          </p>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Build / Test & Export</h2>
          {created ? (
            <p>
              Project created at <code className="bg-[#ecece8] px-1">{created.directoryPath}</code>
            </p>
          ) : (
            <p>Create the project on the previous step first.</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border border-line p-4">
              <h3 className="font-semibold">Build & Test</h3>
              <p className="mt-2 text-sm text-muted">
                After you generate files in Design, the Test tab can run a real `./gradlew build` for Fabric 1.21 /
                1.21.1. This wizard step does not start a build and will not fake success.
              </p>
              <Button className="mt-3" disabled>
                Build from wizard (use Test tab)
              </Button>
            </div>
            <div className="border border-line p-4">
              <h3 className="font-semibold">Export</h3>
              <p className="mt-2 text-sm text-muted">
                Coming in a later phase. Packaging a jar or zip is not implemented.
              </p>
              <Button className="mt-3" disabled>
                Export (Phase 3)
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={step === 0 || busy}
          onClick={() => {
            setError(null)
            setStep((value) => Math.max(0, value - 1))
          }}
        >
          Back
        </Button>
        <Button disabled={!canContinue || busy} onClick={() => void goNext()}>
          {busy ? 'Working…' : primaryLabel}
        </Button>
      </div>
    </div>
  )
}
