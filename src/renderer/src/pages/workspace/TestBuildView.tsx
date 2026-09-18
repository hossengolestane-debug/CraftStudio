import { useEffect, useState } from 'react'
import type { AppErrorPayload } from '../../../../shared/errors'
import type { BuildResultDto, JavaStatusDto } from '../../../../shared/ipc'
import type { PlatformAdapterInfo, ProjectRecord } from '../../../../shared/types'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Badge, Button, Card, ComingSoon } from '../../components/ui'
import { asAppError } from '../../lib/errors'

const api = window.craftstudio

export function TestBuildView({
  project,
  adapter
}: {
  project: ProjectRecord
  adapter?: PlatformAdapterInfo
}) {
  const fabric = project.manifest.platform === 'fabric'
  const [java, setJava] = useState<JavaStatusDto | null>(null)
  const [result, setResult] = useState<BuildResultDto | null>(null)
  const [logs, setLogs] = useState('')
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!fabric) {
      return
    }
    void api.checkJava(project.manifest.id).then(setJava).catch((err) => setError(asAppError(err)))
    const off = api.onBuildLog((event) => {
      setLogs((current) => `${current}${event.text}`)
    })
    return off
  }, [fabric, project.manifest.id])

  if (!fabric) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Test</h1>
        <ComingSoon title={`${project.manifest.platform} builds are not implemented`} phase="Later phase">
          <p>Phase 2 only runs Gradle for Fabric 1.21 / 1.21.1. This button will not fake a pass.</p>
          {adapter?.testProcedures.map((procedure) => (
            <p key={procedure.id} className="text-sm text-muted">
              {procedure.displayName}: {procedure.description}
            </p>
          ))}
          <button type="button" disabled className="mt-2 border border-line px-3 py-2 text-muted">
            Run build (unavailable)
          </button>
        </ComingSoon>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Test</h1>
        <p className="mt-1 text-muted">
          Real `./gradlew build` for Fabric. Minecraft `runClient` is still a later phase and is not faked.
        </p>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Java toolchain</span>
          {java ? <Badge tone={java.meets ? 'ok' : 'danger'}>{java.meets ? 'Ready' : 'Missing / old'}</Badge> : null}
        </div>
        <p className="text-sm">{java?.message ?? 'Checking Java…'}</p>
        <div className="flex gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setLogs('')
              setResult(null)
              void api
                .runBuild(project.manifest.id)
                .then(setResult)
                .catch((err) => setError(asAppError(err)))
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Building…' : 'Run Gradle build'}
          </Button>
          <Button variant="ghost" onClick={() => void api.cancelBuild()}>
            Cancel
          </Button>
        </div>
        {result ? (
          <p>
            {result.message} Command: <code>{result.command}</code>
            {result.exitCode !== null ? ` (exit ${result.exitCode})` : null}
          </p>
        ) : null}
        <pre className="max-h-80 overflow-auto bg-[#111] p-3 text-xs text-[#f5f5f2]">{logs || result?.logs}</pre>
      </Card>
    </div>
  )
}
