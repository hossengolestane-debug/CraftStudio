import { useEffect, useState } from 'react'
import type { AppErrorPayload } from '../../../../shared/errors'
import type { ApplyResultDto, GenerationProgress, GenerationResultDto } from '../../../../shared/ipc'
import type { ProjectSpec } from '../../../../shared/spec'
import type { AppSettings, OllamaStatus, PlatformAdapterInfo, ProjectRecord } from '../../../../shared/types'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Badge, Button, Card, Field, TextArea, TextInput } from '../../components/ui'
import { asAppError } from '../../lib/errors'

const api = window.craftstudio

export function DesignGenerate({
  project,
  adapter,
  settings,
  onSaved
}: {
  project: ProjectRecord
  adapter?: PlatformAdapterInfo
  settings: AppSettings | null
  onSaved: (id: string, input: { name?: string; description?: string }) => Promise<void>
}) {
  const [name, setName] = useState(project.manifest.name)
  const [description, setDescription] = useState(project.manifest.description)
  const [prompt, setPrompt] = useState(project.manifest.description)
  const [model, setModel] = useState(settings?.ollamaModel ?? '')
  const [models, setModels] = useState<string[]>([])
  const [mode, setMode] = useState<'auto' | 'template' | 'ollama'>('auto')
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress[]>([])
  const [generation, setGeneration] = useState<GenerationResultDto | null>(null)
  const [preview, setPreview] = useState<ApplyResultDto | null>(null)
  const [spec, setSpec] = useState<ProjectSpec | null>(null)

  useEffect(() => {
    setName(project.manifest.name)
    setDescription(project.manifest.description)
    setPrompt((current) => current || project.manifest.description)
  }, [project.manifest.description, project.manifest.name])

  useEffect(() => {
    if (settings?.ollamaModel) {
      setModel(settings.ollamaModel)
    }
  }, [settings?.ollamaModel])

  useEffect(() => {
    const off = api.onGenerationProgress((event) => {
      setProgress((list) => [...list.slice(-20), event])
    })
    void api.getSpec(project.manifest.id).then(setSpec).catch(() => undefined)
    return off
  }, [project.manifest.id])

  const fabricReady = project.manifest.platform === 'fabric'

  const refreshModels = async (): Promise<OllamaStatus> => {
    const status = await api.checkOllama()
    setModels(status.models.map((item) => item.name))
    if (!model && status.models[0]) {
      setModel(status.models[0].name)
    }
    return status
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Design</h1>
        <p className="mt-1 text-muted">
          Describe features, generate a validated spec, then apply trusted Fabric templates. Model output is never
          written until Zod accepts it.
        </p>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{project.manifest.type}</Badge>
          <Badge>{project.manifest.platform}</Badge>
          <Badge>{project.manifest.minecraftVersion}</Badge>
        </div>
        <Field label="Name" htmlFor="design-name">
          <TextInput id="design-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Project description" htmlFor="design-description">
          <TextArea
            id="design-description"
            rows={3}
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
            void onSaved(project.manifest.id, { name, description })
              .then(() => setSaved(true))
              .catch((err) => setError(asAppError(err)))
              .finally(() => setBusy(false))
          }}
        >
          Save metadata
        </Button>
        {saved ? <p role="status">Metadata saved.</p> : null}
        <p className="text-sm text-muted">Folder: {project.directoryPath}</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Generate specification</h2>
        {!fabricReady ? (
          <p>
            Phase 2 codegen is Fabric-only. This {project.manifest.platform} project cannot emit Gradle files. The
            adapter will not pretend otherwise.
          </p>
        ) : (
          <>
            <Field
              label="What should this mod add?"
              htmlFor="feature-prompt"
              hint="Simple items use trusted templates. Ollama is only asked when you choose it or the request looks too complex for templates."
            >
              <TextArea
                id="feature-prompt"
                rows={4}
                maxLength={4000}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Generation mode" htmlFor="gen-mode">
                <select
                  id="gen-mode"
                  className="w-full border border-line bg-white px-3 py-2"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as typeof mode)}
                >
                  <option value="auto">Auto (template first)</option>
                  <option value="template">Template only</option>
                  <option value="ollama">Ask local Ollama</option>
                </select>
              </Field>
              <Field label="Local model" htmlFor="gen-model" hint="Used only if Ollama is called.">
                <div className="flex gap-2">
                  <TextInput
                    id="gen-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="llama3.2:latest"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void refreshModels().catch((err) => setError(asAppError(err)))
                    }}
                  >
                    List
                  </Button>
                </div>
              </Field>
            </div>
            {models.length > 0 ? (
              <p className="text-sm text-muted">Installed: {models.join(', ')}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  setError(null)
                  setProgress([])
                  setPreview(null)
                  void api
                    .generateSpec({
                      projectId: project.manifest.id,
                      prompt,
                      mode,
                      model: model || undefined
                    })
                    .then((result) => {
                      setGeneration(result)
                      setSpec(result.spec)
                    })
                    .catch((err) => setError(asAppError(err)))
                    .finally(() => setBusy(false))
                }}
              >
                {busy ? 'Generating…' : 'Generate specification'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void api.cancelGeneration()}>
                Cancel
              </Button>
            </div>
            {progress.length > 0 ? (
              <ol className="max-h-40 overflow-auto border border-line bg-[#f7f7f3] p-3 text-sm">
                {progress.map((item, index) => (
                  <li key={`${item.stage}-${index}`}>
                    <span className="font-medium">{item.stage}:</span> {item.message}
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        )}
      </Card>

      {generation ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Validated specification</h2>
          <p className="text-sm">
            Source: {generation.spec.source}. Ollama used: {generation.usedOllama ? 'yes' : 'no'}. Repairs:{' '}
            {generation.repairAttempts}.
          </p>
          {generation.ollamaNote ? <p className="text-sm text-muted">{generation.ollamaNote}</p> : null}
          {generation.remainingProblems.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {generation.remainingProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
          <ul className="space-y-1 text-sm">
            {generation.spec.items.map((item) => (
              <li key={item.id}>
                <span className="font-medium">{item.displayName}</span> ({item.id}) max {item.maxCount}
              </li>
            ))}
          </ul>
          {generation.spec.recipes.length > 0 ? (
            <p className="text-sm">{generation.spec.recipes.length} shapeless recipe(s).</p>
          ) : null}
        </Card>
      ) : spec ? (
        <Card>
          <h2 className="text-lg font-semibold">Saved specification</h2>
          <p className="mt-2 text-sm">
            {spec.displayName} · {spec.items.length} item(s) already on disk in `{SPEC_HINT}`.
          </p>
        </Card>
      ) : null}

      {(generation || spec) && fabricReady ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold">Apply to project</h2>
          <p className="text-sm text-muted">
            Apply writes Gradle and Java from trusted templates. Existing files show a change summary before overwrite.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                const next = generation?.spec ?? spec
                if (!next) {
                  return
                }
                setBusy(true)
                void api
                  .previewApply(project.manifest.id, next)
                  .then((result) => setPreview({ ...result, applied: false }))
                  .catch((err) => setError(asAppError(err)))
                  .finally(() => setBusy(false))
              }}
            >
              Review file changes
            </Button>
            <Button
              disabled={busy || !(generation?.spec ?? spec)}
              onClick={() => {
                const next = generation?.spec ?? spec
                if (!next) {
                  return
                }
                setBusy(true)
                void api
                  .applySpec(project.manifest.id, next, true)
                  .then(setPreview)
                  .catch((err) => setError(asAppError(err)))
                  .finally(() => setBusy(false))
              }}
            >
              Apply files
            </Button>
          </div>
          {preview ? (
            <div className="space-y-2 text-sm">
              <p>
                {preview.applied ? 'Files written.' : 'Preview only — nothing was written yet.'} Overwrites:{' '}
                {preview.overwriteCount}.
              </p>
              {preview.buildScriptChanges.length > 0 ? (
                <p>
                  Build scripts come from CraftStudio templates (never from the model):{' '}
                  {preview.buildScriptChanges.join(', ')}
                </p>
              ) : null}
              <ul className="max-h-64 space-y-2 overflow-auto border border-line p-3">
                {preview.changes.map((change) => (
                  <li key={change.relativePath}>
                    <span className="font-medium">{change.action}</span> {change.relativePath}
                    {change.action === 'overwrite' ? (
                      <details className="mt-1">
                        <summary>Show before / after</summary>
                        <pre className="mt-1 whitespace-pre-wrap bg-[#f7f7f3] p-2 text-xs">{change.previous}</pre>
                        <pre className="mt-1 whitespace-pre-wrap bg-[#ecece8] p-2 text-xs">{change.nextPreview}</pre>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {adapter ? (
        <Card>
          <h2 className="text-lg font-semibold">Adapter capabilities</h2>
          <p className="mt-2 text-sm text-muted">
            Gradle emission: {adapter.capabilities.gradleProject}. Client entities: {adapter.capabilities.clientEntities}.
          </p>
        </Card>
      ) : null}
    </div>
  )
}

const SPEC_HINT = 'craftstudio.spec.json'
