import { useEffect, useId, useState } from 'react'
import type { AppErrorPayload } from '../../../shared/errors'
import type { AppSettings, OllamaStatus } from '../../../shared/types'
import type { AppDefaults } from '../../../shared/ipc'
import { ErrorPanel } from '../components/ErrorPanel'
import { Badge, Button, Card, Field, TextInput } from '../components/ui'
import { asAppError } from '../lib/errors'

export function SettingsPage({
  settings,
  defaults,
  onSave,
  onCheckOllama,
  onCancelOllama,
  onBrowse
}: {
  settings: AppSettings | null
  defaults: AppDefaults | null
  onSave: (patch: Partial<AppSettings>) => Promise<void>
  onCheckOllama: (endpoint?: string) => Promise<OllamaStatus>
  onCancelOllama: () => Promise<void>
  onBrowse: () => Promise<string | null>
}) {
  const [projectsPath, setProjectsPath] = useState('')
  const [ollamaEndpoint, setOllamaEndpoint] = useState('')
  const [timeoutMs, setTimeoutMs] = useState('8000')
  const [model, setModel] = useState('')
  const [generateTimeout, setGenerateTimeout] = useState('120000')
  const [numPredict, setNumPredict] = useState('2048')
  const [numCtx, setNumCtx] = useState('4096')
  const [repairs, setRepairs] = useState('2')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [saved, setSaved] = useState(false)
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
                maxRepairAttempts: Number(repairs)
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
              setChecking(true)
              setError(null)
              void onCheckOllama(ollamaEndpoint)
                .then(setStatus)
                .catch((err) => setError(asAppError(err)))
                .finally(() => setChecking(false))
            }}
          >
            {checking ? 'Checking…' : 'Check Ollama'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void onCancelOllama().catch((err) => setError(asAppError(err)))
            }}
          >
            Cancel check
          </Button>
        </div>

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
              compile success is not a Tested compatibility row.
            </span>
          </label>
          <p className="text-sm text-muted">
            Accepted at: {settings.runtimeTermsAcceptedAt ?? 'never'}
          </p>
        </div>

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
            <Field label="Preferred local model" htmlFor="ollama-model" hint="Must already be installed in Ollama.">
              <TextInput id="ollama-model" value={model} onChange={(event) => setModel(event.target.value)} />
            </Field>
            <Field
              label="Ollama check timeout (ms)"
              htmlFor="ollama-timeout"
              hint="1,000–60,000. Used for connection checks."
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
            <Field label="num_predict" htmlFor="num-predict" hint="Token cap sent to Ollama.">
              <TextInput
                id="num-predict"
                inputMode="numeric"
                value={numPredict}
                onChange={(event) => setNumPredict(event.target.value)}
              />
            </Field>
            <Field label="num_ctx" htmlFor="num-ctx">
              <TextInput id="num-ctx" inputMode="numeric" value={numCtx} onChange={(event) => setNumCtx(event.target.value)} />
            </Field>
            <Field label="Max repair attempts" htmlFor="repairs" hint="0–3. Remaining problems are shown if repair fails.">
              <TextInput id="repairs" inputMode="numeric" value={repairs} onChange={(event) => setRepairs(event.target.value)} />
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
