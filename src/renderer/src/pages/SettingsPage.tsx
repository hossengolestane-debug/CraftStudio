import { useEffect, useId, useRef, useState } from 'react'
import type { AppErrorPayload } from '../../../shared/errors'
import type { AppSettings, OllamaStatus } from '../../../shared/types'
import type { AppDefaults, ModelTestResultDto, OllamaUnloadResultDto } from '../../../shared/ipc'
import { EnvironmentDoctor } from '../components/EnvironmentDoctor'
import { ErrorPanel } from '../components/ErrorPanel'
import { Badge, Button, Card, Field, TextInput } from '../components/ui'
import { asAppError } from '../lib/errors'

export function SettingsPage({
  settings,
  defaults,
  onSave,
  onCheckOllama,
  onCancelOllama,
  onTestOllama,
  onUnloadOllama,
  onCancelInference,
  onBrowse
}: {
  settings: AppSettings | null
  defaults: AppDefaults | null
  onSave: (patch: Partial<AppSettings>) => Promise<void>
  onCheckOllama: (endpoint?: string) => Promise<OllamaStatus>
  onCancelOllama: () => Promise<void>
  onTestOllama: (endpoint?: string, model?: string) => Promise<ModelTestResultDto>
  onUnloadOllama: (endpoint?: string, model?: string) => Promise<OllamaUnloadResultDto>
  onCancelInference: () => Promise<void>
  onBrowse: () => Promise<string | null>
}) {
  const [projectsPath, setProjectsPath] = useState('')
  const [ollamaEndpoint, setOllamaEndpoint] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('8000')
  const [model, setModel] = useState('')
  const [generateTimeout, setGenerateTimeout] = useState('120000')
  const [numPredict, setNumPredict] = useState('1024')
  const [numCtx, setNumCtx] = useState('2048')
  const [repairs, setRepairs] = useState('2')
  const [persistFull, setPersistFull] = useState(false)
  const [retentionHours, setRetentionHours] = useState('48')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [testResult, setTestResult] = useState<ModelTestResultDto | null>(null)
  const [unloadNote, setUnloadNote] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [testing, setTesting] = useState(false)
  const [unloading, setUnloading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [saved, setSaved] = useState(false)
  const checkLock = useRef(false)
  const testLock = useRef(false)
  const advancedId = useId()

  useEffect(() => {
    if (!settings) {
      return
    }
    setProjectsPath(settings.projectsPath)
    setOllamaEndpoint(settings.ollamaEndpoint)
    setTimeoutMs(String(settings.ollamaTimeoutMs))
    setModel(settings.ollamaModel ?? '')
    setGenerateTimeout(String(settings.ollamaGenerateTimeoutMs))
    setNumPredict(String(settings.ollamaNumPredict))
    setNumCtx(String(settings.ollamaNumCtx))
    setRepairs(String(settings.maxRepairAttempts))
    setPersistFull(settings.persistFullAiLogs)
    setRetentionHours(String(settings.activityRetentionHours))
  }, [settings])

  if (!settings || !defaults) {
    return <p>Loading settings…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted">Saved as JSON in the app userData folder. Ollama stays local — no cloud fallback.</p>
      </div>

      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}
      {saved ? (
        <p role="status" className="border border-ink bg-white px-3 py-2">
          Settings saved.
        </p>
      ) : null}

      <Card className="space-y-4">
        <Field
          label="Projects folder"
          htmlFor="projects-path"
          hint={`Default is the app userData folder (${defaults.defaultProjectsPath}). You can switch to ${defaults.homeProjectsPath}.`}
        >
          <div className="flex gap-2">
            <TextInput
              id="projects-path"
              value={projectsPath}
              onChange={(event) => setProjectsPath(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void onBrowse()
                  .then((path) => {
                    if (path) {
                      setProjectsPath(path)
                    }
                  })
                  .catch((err) => setError(asAppError(err)))
              }}
            >
              Browse
            </Button>
          </div>
        </Field>

        <Field
          label="Ollama endpoint"
          htmlFor="ollama-endpoint"
          hint="Default http://localhost:11434. CraftStudio only calls this URL."
        >
          <TextInput
            id="ollama-endpoint"
            value={ollamaEndpoint}
            onChange={(event) => setOllamaEndpoint(event.target.value)}
          />
        </Field>
        <Field
          label="Preferred local model"
          htmlFor="ollama-model"
          hint="Exact installed tag. CraftStudio never picks the first listed model for you."
        >
          <TextInput id="ollama-model" value={model} onChange={(event) => setModel(event.target.value)} />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving}
            onClick={() => {
              setSaving(true)
              setSaved(false)
              setError(null)
              void onSave({
                projectsPath,
                ollamaEndpoint,
                ollamaTimeoutMs: Number(timeoutMs),
                ollamaModel: model.trim() || null,
                ollamaGenerateTimeoutMs: Number(generateTimeout),
                ollamaNumPredict: Number(numPredict),
                ollamaNumCtx: Number(numCtx),
                maxRepairAttempts: Number(repairs),
                persistFullAiLogs: persistFull,
                activityRetentionHours: Number(retentionHours)
              })
                .then(() => setSaved(true))
                .catch((err) => setError(asAppError(err)))
                .finally(() => setSaving(false))
            }}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          <Button
            variant="secondary"
            disabled={checking}
            onClick={() => {
              if (checkLock.current) {
                return
              }
              checkLock.current = true
              setChecking(true)
              setError(null)
              void onCheckOllama(ollamaEndpoint)
                .then(setStatus)
                .catch((err) => setError(asAppError(err)))
                .finally(() => {
                  checkLock.current = false
                  setChecking(false)
                })
            }}
          >
            {checking ? 'Checking…' : 'Check connection'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void onCancelOllama().catch((err) => setError(asAppError(err)))
            }}
          >
            Cancel check
          </Button>
          <Button
            variant="secondary"
            disabled={testing || !model.trim()}
            onClick={() => {
              if (testLock.current) {
                return
              }
              testLock.current = true
              setTesting(true)
              setError(null)
              setTestResult(null)
              void onTestOllama(ollamaEndpoint, model.trim())
                .then(setTestResult)
                .catch((err) => setError(asAppError(err)))
                .finally(() => {
                  testLock.current = false
                  setTesting(false)
                })
            }}
          >
            {testing ? 'Testing model…' : 'Test model'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void onCancelInference().catch((err) => setError(asAppError(err)))
            }}
          >
            Cancel inference
          </Button>
          <Button
            variant="ghost"
            disabled={unloading || !model.trim()}
            onClick={() => {
              if (
                !window.confirm(
                  `Unload ${model.trim()} from Ollama? Other apps sharing that model may hitch or reload it. Unrelated models are not unloaded.`
                )
              ) {
                return
              }
              setUnloading(true)
              setError(null)
              void onUnloadOllama(ollamaEndpoint, model.trim())
                .then((result) => setUnloadNote(result.message))
                .catch((err) => setError(asAppError(err)))
                .finally(() => setUnloading(false))
            }}
          >
            {unloading ? 'Unloading…' : 'Unload model'}
          </Button>
        </div>
        <p className="text-sm text-muted">
          Check connection calls <code>/api/tags</code> only (metadata, 5s cap). It never starts inference or loads a
          model. Test model is an explicit short ping and counts as the single active inference. Context and output
          limits below apply only to CraftStudio requests — they do not control other programs using Ollama.
        </p>

        <div className="border border-line p-4 space-y-2">
          <h2 className="font-semibold">Minecraft / runtime terms</h2>
          <p className="text-sm">
            CraftStudio never silent-accepts the Minecraft EULA, never distributes game files, and never bypasses
            authentication. Checking this only unlocks optional Fabric <code>runClient</code> wiring.
          </p>
          <p className="text-sm">
            <a className="underline" href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">
              Read the Minecraft EULA
            </a>
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.minecraftEulaAccepted}
              onChange={(event) => {
                void onSave({
                  minecraftEulaAccepted: event.target.checked,
                  runtimeTermsAcceptedAt: event.target.checked ? new Date().toISOString() : null
                }).catch((err) => setError(asAppError(err)))
              }}
            />
            <span>
              I have read the Minecraft EULA and accept it for optional developer launches on this machine. I understand
              compile success is not a Tested compatibility row. Tested requires a recorded runtime evidence entry.
            </span>
          </label>
          <p className="text-sm text-muted">
            Accepted at: {settings.runtimeTermsAcceptedAt ?? 'never'}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="Output limit (num_predict)"
            htmlFor="num-predict"
            hint="Tokens CraftStudio asks Ollama to generate (128–8192). Default 1024. Does not cap other Ollama clients."
          >
            <TextInput
              id="num-predict"
              inputMode="numeric"
              value={numPredict}
              onChange={(event) => setNumPredict(event.target.value)}
            />
          </Field>
          <Field
            label="Context limit (num_ctx)"
            htmlFor="num-ctx"
            hint="Context window sent with CraftStudio requests (512–32768). Default 2048."
          >
            <TextInput id="num-ctx" inputMode="numeric" value={numCtx} onChange={(event) => setNumCtx(event.target.value)} />
          </Field>
        </div>

        <EnvironmentDoctor requiredJava={21} />

        {status ? (
          <div className="border border-line p-4">
            <div className="flex items-center gap-2">
              <Badge tone={status.connected ? 'ok' : 'danger'}>
                {status.connected ? 'Connected' : 'Not connected'}
              </Badge>
              <span className="text-sm text-muted">{status.endpoint}</span>
            </div>
            <p className="mt-2">{status.message}</p>
            <p className="mt-1 text-sm text-muted">{status.recovery}</p>
            {status.models.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {status.models.map((model) => (
                  <li key={model.name}>{model.name}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-sm text-muted">
              This check only calls `/api/tags`. Generation success requires a validated spec plus written files — never
              the model saying it worked.
            </p>
          </div>
        ) : null}
        {testResult ? (
          <div className="border border-line p-4 text-sm">
            <p className="font-medium">Model test</p>
            <p>
              Model: {testResult.model}. num_predict={testResult.settings.numPredict} num_ctx=
              {testResult.settings.numCtx} timeout={testResult.settings.timeoutMs}ms temperature=
              {testResult.settings.temperature}. Request {testResult.requestId}.
            </p>
            <pre className="mt-2 whitespace-pre-wrap bg-[#f7f7f3] p-2 text-xs">
              {testResult.reply}
              {testResult.truncated ? '\n…[truncated]' : ''}
            </pre>
          </div>
        ) : null}
        {unloadNote ? <p className="text-sm">{unloadNote}</p> : null}
      </Card>

      <div>
        <button
          type="button"
          className="font-medium underline"
          aria-expanded={advancedOpen}
          aria-controls={advancedId}
          onClick={() => setAdvancedOpen((value) => !value)}
        >
          {advancedOpen ? 'Hide advanced settings' : 'Show advanced settings'}
        </button>
        {advancedOpen ? (
          <Card id={advancedId} className="mt-3 space-y-4">
            <Field
              label="Ollama check timeout (ms)"
              htmlFor="ollama-timeout"
              hint="Requested 1,000–60,000. Connection checks are still capped at 5 seconds and never start inference."
            >
              <TextInput
                id="ollama-timeout"
                inputMode="numeric"
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
              />
            </Field>
            <Field label="Generation timeout (ms)" htmlFor="gen-timeout">
              <TextInput
                id="gen-timeout"
                inputMode="numeric"
                value={generateTimeout}
                onChange={(event) => setGenerateTimeout(event.target.value)}
              />
            </Field>
            <Field label="Max repair attempts" htmlFor="repairs" hint="0–3. Remaining problems are shown if repair fails. Resource exhaustion is not auto-retried.">
              <TextInput id="repairs" inputMode="numeric" value={repairs} onChange={(event) => setRepairs(event.target.value)} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={persistFull}
                onChange={(event) => setPersistFull(event.target.checked)}
              />
              <span>
                Persist full AI prompts/responses in Live Activity (opt-in). Secrets are still redacted. Off by default —
                only bounded previews are stored.
              </span>
            </label>
            <Field
              label="Activity log retention (hours)"
              htmlFor="activity-retention"
              hint="1–168. In-memory feed is also capped at 400 events. Disk logs rotate."
            >
              <TextInput
                id="activity-retention"
                inputMode="numeric"
                value={retentionHours}
                onChange={(event) => setRetentionHours(event.target.value)}
              />
            </Field>
            <p className="text-sm text-muted">Settings schema version: {settings.schemaVersion}</p>
            <p className="text-sm text-muted">
              Last opened project id: {settings.lastOpenedProjectId ?? 'none'}
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
