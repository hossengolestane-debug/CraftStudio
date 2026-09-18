import { useState } from 'react'
import type { AppErrorPayload } from '../../../shared/errors'
import type { PlatformAdapterInfo, ProjectRecord } from '../../../shared/types'
import type { WorkspaceTab } from '../components/AppShell'
import { ErrorPanel } from '../components/ErrorPanel'
import { Badge, Button, Card, ComingSoon, Field, TextArea, TextInput } from '../components/ui'
import { asAppError } from '../lib/errors'
import { describeCapabilityGap } from '../../../shared/adapters/registry'

export function WorkspacePage({
  project,
  tab,
  adapters,
  onSave
}: {
  project: ProjectRecord
  tab: WorkspaceTab
  adapters: PlatformAdapterInfo[]
  onSave: (id: string, input: { name?: string; description?: string }) => Promise<void>
}) {
  const adapter = adapters.find((item) => item.id === project.manifest.platform)

  if (tab === 'code') {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Code</h1>
        <ComingSoon title="Monaco and generated sources are not in Phase 1" phase="Phase 2">
          <p>The Code tab is present so you can find it, but it is not the default and it does not edit files.</p>
          <button type="button" disabled className="mt-2 border border-line px-3 py-2 text-muted">
            Open Monaco editor (unavailable)
          </button>
        </ComingSoon>
      </div>
    )
  }

  if (tab === 'test') {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Test</h1>
        <ComingSoon title="Minecraft launch and Gradle tests are not implemented" phase="Later phase">
          <p>This view will not start a client or server, and it will not report a fake pass.</p>
          {adapter?.testProcedures.map((procedure) => (
            <p key={procedure.id} className="text-sm text-muted">
              {procedure.displayName}: {procedure.description}
            </p>
          ))}
          <button type="button" disabled className="mt-2 border border-line px-3 py-2 text-muted">
            Run Minecraft test (unavailable)
          </button>
        </ComingSoon>
      </div>
    )
  }

  return (
    <DesignView project={project} adapter={adapter} onSave={onSave} />
  )
}

function DesignView({
  project,
  adapter,
  onSave
}: {
  project: ProjectRecord
  adapter?: PlatformAdapterInfo
  onSave: (id: string, input: { name?: string; description?: string }) => Promise<void>
}) {
  const [name, setName] = useState(project.manifest.name)
  const [description, setDescription] = useState(project.manifest.description)
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Design</h1>
        <p className="mt-1 text-muted">
          Metadata only. Visual block/item/GUI editors are not in Phase 1.
        </p>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}
      {saved ? (
        <p role="status" className="border border-ink bg-white px-3 py-2">
          Project metadata saved. `updatedAt` was refreshed.
        </p>
      ) : null}
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{project.manifest.type}</Badge>
          <Badge>{project.manifest.platform}</Badge>
          <Badge>{project.manifest.minecraftVersion}</Badge>
        </div>
        <Field label="Name" htmlFor="design-name">
          <TextInput id="design-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Description" htmlFor="design-description">
          <TextArea
            id="design-description"
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setSaved(false)
            void onSave(project.manifest.id, { name, description })
              .then(() => setSaved(true))
              .catch((err) => setError(asAppError(err)))
              .finally(() => setBusy(false))
          }}
        >
          Save metadata
        </Button>
        <p className="text-sm text-muted">Folder: {project.directoryPath}</p>
      </Card>
      {adapter ? (
        <Card>
          <h2 className="text-lg font-semibold">Adapter capabilities</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(
              [
                ['clientEntities', 'New client entities'],
                ['customBlocks', 'Custom blocks'],
                ['textures', 'Textures'],
                ['customGuis', 'GUIs'],
                ['gradleProject', 'Gradle project emission']
              ] as const
            ).map(([key, label]) => (
              <li key={key}>
                <span className="font-medium">{label}:</span> {adapter.capabilities[key]} —{' '}
                {describeCapabilityGap(adapter, key)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
