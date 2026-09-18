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
                ollamaTimeoutMs: Number(timeoutMs)
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
              Generation is Phase 2. This check only calls `/api/tags` and never invents a successful generation.
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
            <Field
              label="Ollama timeout (ms)"
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
