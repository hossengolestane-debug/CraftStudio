import { useEffect, useState } from 'react'
import type { AppErrorPayload } from '../../../../shared/errors'
import type { BuildResultDto, JavaStatusDto } from '../../../../shared/ipc'
import { isCodegenSupported } from '../../../../shared/platformPins'
import type { AppSettings, PlatformAdapterInfo, ProjectRecord } from '../../../../shared/types'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Badge, Button, Card, ComingSoon } from '../../components/ui'
import { asAppError } from '../../lib/errors'

const api = window.craftstudio

export function TestBuildView({
  project,
  adapter,
  settings,
  onAcceptTerms
}: {
  project: ProjectRecord
  adapter?: PlatformAdapterInfo
  settings: AppSettings | null
  onAcceptTerms?: () => Promise<void>
}) {
  const supported = isCodegenSupported(project.manifest.platform, project.manifest.minecraftVersion)
  const fabric = project.manifest.platform === 'fabric'
  const paper = project.manifest.platform === 'paper'
  const [java, setJava] = useState<JavaStatusDto | null>(null)
  const [result, setResult] = useState<BuildResultDto | null>(null)
  const [logs, setLogs] = useState('')
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const accepted = Boolean(settings?.minecraftEulaAccepted)

  useEffect(() => {
    if (!supported) {
      return
    }
    void api.checkJava(project.manifest.id).then(setJava).catch((err) => setError(asAppError(err)))
    const off = api.onBuildLog((event) => {
      setLogs((current) => `${current}${event.text}`)
    })
    return off
  }, [supported, project.manifest.id])

  if (!supported) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold">Test</h1>
        <ComingSoon title={`${project.manifest.platform} ${project.manifest.minecraftVersion} builds are not implemented`} phase="Later phase">
          <p>This button will not fake a pass. Compile and runtime stay separate from compatibility Tested flags.</p>
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
          Real Gradle for {project.manifest.platform} {project.manifest.minecraftVersion}. Compile success is not a
          Tested compatibility row and is never inferred from the model.
        </p>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Java toolchain</span>
          {java ? <Badge tone={java.meets ? 'ok' : 'danger'}>{java.meets ? 'Ready' : 'Missing / old'}</Badge> : null}
          <Badge>Compile: {result?.task === 'build' && result.exitCode === 0 ? 'succeeded' : 'not verified this session'}</Badge>
          <Badge tone="warn">Runtime: Experimental (not Tested)</Badge>
        </div>
        <p className="text-sm">{java?.message ?? 'Checking Java…'}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setLogs('')
              setResult(null)
              void api
                .runBuild(project.manifest.id, 'build')
                .then(setResult)
                .catch((err) => setError(asAppError(err)))
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Working…' : 'Run Gradle build'}
          </Button>
          <Button variant="ghost" onClick={() => void api.cancelBuild()}>
            Cancel
          </Button>
        </div>
        {result ? (
          <p>
            {result.message} Command: <code>{result.command}</code>
            {result.exitCode !== null ? ` (exit ${result.exitCode})` : null}
            {result.compileOnly ? ' · compile-only' : ''}
          </p>
        ) : null}
        <pre className="max-h-80 overflow-auto bg-[#111] p-3 text-xs text-[#f5f5f2]">{logs || result?.logs}</pre>
      </Card>

      {fabric ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Fabric runClient (optional)</h2>
          <p className="text-sm">
            Runs allowlisted <code>./gradlew runClient --no-daemon --stacktrace</code> only after you accept the Minecraft
            EULA. CraftStudio does not distribute game files, does not bypass auth, and does not silent-accept terms.
            A cloud VM often cannot finish a full client run. Compatibility stays Experimental without proof.
          </p>
          <p className="text-sm">
            Terms:{' '}
            <a className="underline" href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">
              minecraft.net/eula
            </a>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={accepted || !onAcceptTerms}
              onClick={() => {
                void onAcceptTerms?.().catch((err) => setError(asAppError(err)))
              }}
            >
              {accepted ? 'EULA accepted (saved)' : 'I accept the Minecraft EULA'}
            </Button>
            <Button
              disabled={busy || !accepted}
              onClick={() => {
                setBusy(true)
                setLogs('')
                setResult(null)
                void api
                  .runBuild(project.manifest.id, 'runClient')
                  .then(setResult)
                  .catch((err) => setError(asAppError(err)))
                  .finally(() => setBusy(false))
              }}
            >
              Run client (Gradle)
            </Button>
          </div>
        </Card>
      ) : null}

      {paper ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Paper test-server prep</h2>
          <p className="text-sm">
            After apply, the project includes <code>run-paper/README.md</code> and <code>run-paper/eula.txt</code> with{' '}
            <code>eula=false</code>. CraftStudio will not download Paper, launch a server, or set eula=true. You must
            accept Minecraft/Paper terms yourself and fetch an official Paper build.
          </p>
          <p className="text-sm">
            Do not install the plugin on Spigot. Paper compile success is not Spigot compatibility.
          </p>
        </Card>
      ) : null}
    </div>
  )
}
