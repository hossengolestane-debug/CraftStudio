import { useEffect, useState } from 'react'
import type { RuntimeEvidenceRecord } from '../../../../shared/evidence'
import type { AppErrorPayload } from '../../../../shared/errors'
import type { BuildResultDto, JavaStatusDto, RepairResultDto } from '../../../../shared/ipc'
import { isCodegenSupported } from '../../../../shared/platformPins'
import type { AppSettings, PlatformAdapterInfo, ProjectRecord } from '../../../../shared/types'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Badge, Button, Card, ComingSoon, Field, TextArea } from '../../components/ui'
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
  const neoforge = project.manifest.platform === 'neoforge'
  const forge = project.manifest.platform === 'forge'
  const paper = project.manifest.platform === 'paper'
  const spigot = project.manifest.platform === 'spigot'
  const canRunClient = fabric || neoforge || forge
  const [java, setJava] = useState<JavaStatusDto | null>(null)
  const [compile, setCompile] = useState<BuildResultDto | null>(null)
  const [runtime, setRuntime] = useState<BuildResultDto | null>(null)
  const [logs, setLogs] = useState('')
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [repair, setRepair] = useState<RepairResultDto | null>(null)
  const [openDiagnostic, setOpenDiagnostic] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<RuntimeEvidenceRecord[]>([])
  const [notes, setNotes] = useState('')
  const [attested, setAttested] = useState(false)
  const accepted = Boolean(settings?.minecraftEulaAccepted)
  const rowEvidence = evidence.find(
    (item) =>
      item.platform === project.manifest.platform && item.minecraftVersion === project.manifest.minecraftVersion
  )

  useEffect(() => {
    void api.listEvidence().then(setEvidence).catch(() => undefined)
  }, [])

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
          Compile success and runtime verification are separate. A Tested compatibility row requires an evidence record
          — never a compile-only build.
        </p>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Java toolchain</span>
          {java ? <Badge tone={java.meets ? 'ok' : 'danger'}>{java.meets ? 'Ready' : 'Missing / old'}</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={compile?.exitCode === 0 ? 'ok' : 'warn'}>
            Compile: {compile?.task === 'build' && compile.exitCode === 0 ? 'succeeded' : 'not verified this session'}
          </Badge>
          <Badge tone={rowEvidence ? 'ok' : 'warn'}>
            Runtime: {rowEvidence ? `Tested ${rowEvidence.timestamp}` : 'not verified'}
          </Badge>
        </div>
        <p className="text-sm">{java?.message ?? 'Checking Java…'}</p>
        {rowEvidence ? (
          <p className="text-sm">
            Evidence: {rowEvidence.verifiedWhat} — {rowEvidence.notes}
          </p>
        ) : (
          <p className="text-sm text-muted">
            No runtime evidence for {project.manifest.platform} {project.manifest.minecraftVersion}. The static registry
            stays Experimental.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setLogs('')
              void api
                .runBuild(project.manifest.id, 'build')
                .then(setCompile)
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
        {compile ? (
          <p>
            {compile.message} Command: <code>{compile.command}</code>
            {compile.exitCode !== null ? ` (exit ${compile.exitCode})` : null}
            {compile.compileOnly ? ' · compile-only' : ''}
          </p>
        ) : null}
        {(compile?.diagnostics ?? []).length > 0 ? (
          <div className="space-y-2">
            <p className="font-medium">Build diagnostics</p>
            {(compile?.diagnostics ?? []).map((item) => (
              <div key={item.id} className="border border-line p-2">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm">{item.action}</p>
                <button
                  type="button"
                  className="mt-1 text-sm underline"
                  onClick={() => setOpenDiagnostic((current) => (current === item.id ? null : item.id))}
                >
                  {openDiagnostic === item.id ? 'Hide technical details' : 'Show technical details'}
                </button>
                {openDiagnostic === item.id ? <pre className="mt-1 whitespace-pre-wrap text-xs">{item.details}</pre> : null}
              </div>
            ))}
            {(compile?.diagnostics ?? []).some((item) => item.repairId) ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void api
                    .repairBuild(project.manifest.id)
                    .then(setRepair)
                    .catch((err) => setError(asAppError(err)))
                    .finally(() => setBusy(false))
                }}
              >
                Try known template repair
              </Button>
            ) : null}
            {repair ? (
              <p className="text-sm">
                {repair.message}
                {repair.remaining.length > 0 ? ` Remaining: ${repair.remaining.join('; ')}.` : ''}
              </p>
            ) : null}
          </div>
        ) : null}
        <pre className="max-h-80 overflow-auto bg-[#111] p-3 text-xs text-[#f5f5f2]">{logs || compile?.logs || runtime?.logs}</pre>
      </Card>

      {canRunClient ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">
            {fabric ? 'Fabric' : forge ? 'Forge' : 'NeoForge'} runClient (optional)
          </h2>
          <p className="text-sm">
            Runs allowlisted <code>./gradlew runClient --no-daemon --stacktrace</code> only after you accept the Minecraft
            EULA. CraftStudio does not distribute game files, does not bypass auth, and does not silent-accept terms.
            Exit 0 is not an automatic Tested badge — record evidence below after you verify the client.
          </p>
          {neoforge ? <p className="text-sm">NeoForge success is not Forge compatibility.</p> : null}
          {forge ? <p className="text-sm">Forge success is not NeoForge compatibility.</p> : null}
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
                void api
                  .runBuild(project.manifest.id, 'runClient')
                  .then(setRuntime)
                  .catch((err) => setError(asAppError(err)))
                  .finally(() => setBusy(false))
              }}
            >
              Run client (Gradle)
            </Button>
          </div>
          {runtime ? <p>{runtime.message}</p> : null}
          <Field label="What did you verify?" htmlFor="runtime-notes">
            <TextArea
              id="runtime-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Example: runClient loaded the title screen and the custom item appeared in Ingredients."
            />
          </Field>
          <Button
            variant="secondary"
            disabled={busy || !accepted || runtime?.exitCode !== 0}
            onClick={() => {
              void api
                .recordEvidence({
                  projectId: project.manifest.id,
                  verifiedWhat: fabric
                    ? 'fabric_run_client'
                    : forge
                      ? 'forge_run_client'
                      : 'neoforge_run_client',
                  notes
                })
                .then((record) => {
                  setEvidence((current) => [
                    ...current.filter(
                      (item) =>
                        !(item.platform === record.platform && item.minecraftVersion === record.minecraftVersion)
                    ),
                    record
                  ])
                })
                .catch((err) => setError(asAppError(err)))
            }}
          >
            Record runtime verification
          </Button>
        </Card>
      ) : null}

      {paper || spigot ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">{paper ? 'Paper' : 'Spigot'} test-server prep</h2>
          <p className="text-sm">
            After apply, the project includes{' '}
            <code>{paper ? 'run-paper' : 'run-spigot'}/README.md</code> and{' '}
            <code>{paper ? 'run-paper' : 'run-spigot'}/eula.txt</code> with <code>eula=false</code>. CraftStudio will not
            download a server, launch it, or set eula=true.
          </p>
          <p className="text-sm">
            {paper
              ? 'Do not install the plugin on Spigot. Paper compile success is not Spigot compatibility.'
              : 'Do not install the plugin on Paper and expect it to be a Paper plugin. Spigot compile success is not Paper compatibility.'}
          </p>
          <p className="text-sm">
            Terms:{' '}
            <a className="underline" href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">
              minecraft.net/eula
            </a>
          </p>
          <Button
            variant="secondary"
            disabled={accepted || !onAcceptTerms}
            onClick={() => {
              void onAcceptTerms?.().catch((err) => setError(asAppError(err)))
            }}
          >
            {accepted ? 'EULA accepted (saved)' : 'I accept the Minecraft EULA'}
          </Button>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} />
            I launched a {paper ? 'Paper' : 'Spigot'} server I downloaded myself and confirmed this plugin loaded.
            CraftStudio did not start it.
          </label>
          <Field label="What did you verify?" htmlFor="paper-notes">
            <TextArea
              id="paper-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Example: Paper 1.21.1 server I installed; /givecustomitem worked with the resource pack."
            />
          </Field>
          <Button
            variant="secondary"
            disabled={!accepted || !attested}
            onClick={() => {
              void api
                .recordEvidence({
                  projectId: project.manifest.id,
                  verifiedWhat: paper ? 'paper_user_server' : 'spigot_user_server',
                  notes,
                  userAttestedLaunch: attested
                })
                .then((record) => {
                  setEvidence((current) => [
                    ...current.filter(
                      (item) =>
                        !(item.platform === record.platform && item.minecraftVersion === record.minecraftVersion)
                    ),
                    record
                  ])
                })
                .catch((err) => setError(asAppError(err)))
            }}
          >
            Record {paper ? 'Paper' : 'Spigot'} runtime attestation
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
