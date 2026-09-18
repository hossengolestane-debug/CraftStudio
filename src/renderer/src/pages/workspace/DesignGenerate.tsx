import { useEffect, useState } from 'react'
import { useSpecHistory } from '../../lib/specHistory'
import type { AppErrorPayload } from '../../../../shared/errors'
import type {
  ApplyResultDto,
  GenerationProgress,
  GenerationResultDto,
  MigrationAssessmentDto,
  SnapshotRecordDto
} from '../../../../shared/ipc'
import { isCodegenSupported } from '../../../../shared/platformPins'
import { parseProjectSpec, type ProjectSpec } from '../../../../shared/spec'
import type { AppSettings, OllamaStatus, PlatformAdapterInfo, ProjectRecord } from '../../../../shared/types'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Badge, Button, Card, Field, TextArea, TextInput } from '../../components/ui'
import { asAppError } from '../../lib/errors'
import { BlockEditor } from './BlockEditor'
import { ItemEditor } from './ItemEditor'
import { MobEditor } from './MobEditor'
import { ModGuiEditor } from './ModGuiEditor'
import { PluginGuiEditor } from './PluginGuiEditor'
import { WorldgenEditor } from './WorldgenEditor'

const api = window.craftstudio
const SPEC_HINT = 'craftstudio.spec.json'

export function DesignGenerate({
  project,
  adapter,
  settings,
  onSaved
}: {
  project: ProjectRecord
  adapter?: PlatformAdapterInfo
  settings: AppSettings | null
  onSaved: (id: string, input: { name?: string; description?: string; minecraftVersion?: string }) => Promise<void>
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
  const specHistory = useSpecHistory(null)
  const spec = specHistory.current
  const replaceSpec = specHistory.replaceCurrent
  const [versionTarget, setVersionTarget] = useState(project.manifest.minecraftVersion)
  const [assessment, setAssessment] = useState<MigrationAssessmentDto | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotRecordDto[]>([])

  useEffect(() => {
    setName(project.manifest.name)
    setDescription(project.manifest.description)
    setPrompt((current) => current || project.manifest.description)
  }, [project.manifest.description, project.manifest.name])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return
      }
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        specHistory.undo()
      }
      if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault()
        specHistory.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [specHistory])

  useEffect(() => {
    if (settings?.ollamaModel) {
      setModel(settings.ollamaModel)
    }
  }, [settings?.ollamaModel])

  useEffect(() => {
    const off = api.onGenerationProgress((event) => {
      setProgress((list) => [...list.slice(-20), event])
    })
    void api.getSpec(project.manifest.id).then((loaded) => replaceSpec(loaded)).catch(() => undefined)
    void api.listSnapshots(project.manifest.id).then(setSnapshots).catch(() => undefined)
    return off
  }, [project.manifest.id, replaceSpec])

  const codegenReady = isCodegenSupported(project.manifest.platform, project.manifest.minecraftVersion)
  const pluginLimits = project.manifest.platform === 'paper' || project.manifest.platform === 'spigot'
  const workingSpec = spec ?? generation?.spec
  const versionChoices = adapter?.compatibility.map((row) => row.minecraftVersion) ?? [project.manifest.minecraftVersion]

  const refreshModels = async (): Promise<OllamaStatus> => {
    const status = await api.checkOllama()
    setModels(status.models.map((item) => item.name))
    if (!model && status.models[0]) {
      setModel(status.models[0].name)
    }
    return status
  }

  const applyWorking = (next: ProjectSpec): void => {
    const draft = { ...next, source: 'editor' as const }
    specHistory.setCurrent(draft)
    setGeneration((current) =>
      current
        ? { ...current, spec: draft }
        : {
            spec: draft,
            usedOllama: false,
            repairAttempts: 0,
            remainingProblems: [],
            ollamaNote: 'Edited in the Design editors. Apply still validates with Zod.',
            success: true
          }
    )
    try {
      parseProjectSpec(draft)
      setError(null)
    } catch (err) {
      setError(asAppError(err))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Design</h1>
        <p className="mt-1 text-muted">
          Describe or edit features, validate a spec, then apply trusted templates. Model output is never written until
          Zod accepts it.
        </p>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{project.manifest.type}</Badge>
          <Badge>{project.manifest.platform}</Badge>
          <Badge>{project.manifest.minecraftVersion}</Badge>
          <Badge tone={codegenReady ? 'ok' : 'warn'}>{codegenReady ? 'Codegen available' : 'No emitter'}</Badge>
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
        <Field
          label="Minecraft version"
          htmlFor="design-version"
          hint="A snapshot is taken before a version change. Incompatible features are listed first."
        >
          <div className="flex flex-wrap gap-2">
            <select
              id="design-version"
              className="border border-line bg-white px-3 py-2"
              value={versionTarget}
              onChange={(event) => {
                setVersionTarget(event.target.value)
                setAssessment(null)
              }}
            >
              {versionChoices.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || versionTarget === project.manifest.minecraftVersion}
              onClick={() => {
                setBusy(true)
                void api
                  .assessVersionChange(project.manifest.id, versionTarget)
                  .then(setAssessment)
                  .catch((err) => setError(asAppError(err)))
                  .finally(() => setBusy(false))
              }}
            >
              Assess change
            </Button>
            <Button
              type="button"
              disabled={busy || !assessment?.canApply || versionTarget === project.manifest.minecraftVersion}
              onClick={() => {
                setBusy(true)
                void onSaved(project.manifest.id, { minecraftVersion: versionTarget })
                  .then(() => api.listSnapshots(project.manifest.id).then(setSnapshots))
                  .then(() => setSaved(true))
                  .catch((err) => setError(asAppError(err)))
                  .finally(() => setBusy(false))
              }}
            >
              Apply version
            </Button>
          </div>
        </Field>
        {assessment ? (
          <div className="space-y-1 text-sm">
            <p>
              {assessment.canApply ? 'This version change can be applied.' : 'This version change is blocked.'}
            </p>
            {assessment.incompatible.map((item) => (
              <p key={item} className="text-sm font-medium">
                {item}
              </p>
            ))}
            {assessment.notes.map((item) => (
              <p key={item} className="text-muted">
                {item}
              </p>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Generate specification</h2>
        {!codegenReady ? (
          <p>
            Phase 9 codegen is Fabric 1.21.x, Paper 1.21.x, NeoForge 1.21.1/1.21.4/1.21.8, Forge 1.21.1, and Spigot
            1.21/1.21.1/1.21.4. This {project.manifest.platform} {project.manifest.minecraftVersion} project cannot emit
            Gradle files. The adapter will not pretend otherwise.
            {project.manifest.platform === 'spigot' ? ' Spigot is not inferred from Paper success.' : ''}
            {project.manifest.platform === 'forge' ? ' Forge is not inferred from NeoForge success.' : ''}
          </p>
        ) : (
          <>
            {pluginLimits ? (
              <p className="text-sm">
                Plugins cannot register new client item or entity types. Generated items are vanilla paper with PDC.
                Custom mobs are vanilla disguises. Clients must install the resource pack from Export.
              </p>
            ) : null}
            <Field
              label="What should this project add?"
              htmlFor="feature-prompt"
              hint="Simple items use trusted templates. Ollama is only asked when you choose it or the request looks too complex."
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
            {models.length > 0 ? <p className="text-sm text-muted">Installed: {models.join(', ')}</p> : null}
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
                      specHistory.replaceCurrent(result.spec)
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

      {workingSpec ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={!specHistory.canUndo} onClick={specHistory.undo}>
              Undo
            </Button>
            <Button type="button" variant="ghost" disabled={!specHistory.canRedo} onClick={specHistory.redo}>
              Redo
            </Button>
            <p className="self-center text-xs text-muted">Design editors keep a 20-step history. Autosave still writes on Apply.</p>
          </div>
          <ItemEditor spec={workingSpec} paperLimits={pluginLimits} onChange={applyWorking} />
          <BlockEditor spec={workingSpec} pluginLimits={pluginLimits} onChange={applyWorking} />
          <MobEditor spec={workingSpec} pluginLimits={pluginLimits} onChange={applyWorking} />
          <WorldgenEditor spec={workingSpec} pluginLimits={pluginLimits} onChange={applyWorking} />
          {project.manifest.type === 'mod' ? (
            <ModGuiEditor
              spec={workingSpec}
              menuEmission={
                project.manifest.platform === 'fabric' ||
                project.manifest.platform === 'forge' ||
                project.manifest.platform === 'neoforge'
              }
              onChange={applyWorking}
            />
          ) : (
            <PluginGuiEditor spec={workingSpec} onChange={applyWorking} />
          )}
        </>
      ) : null}

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
            {generation.spec.blocks.map((block) => (
              <li key={`block-${block.id}`}>
                Block <span className="font-medium">{block.displayName}</span> ({block.id}) {block.material}
              </li>
            ))}
          </ul>
          {generation.spec.recipes.length > 0 ? (
            <p className="text-sm">
              {generation.spec.recipes.length} recipe(s) ({generation.spec.recipes.filter((recipe) => recipe.type === 'shaped').length} shaped).
            </p>
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

      {workingSpec && codegenReady ? (
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
                setBusy(true)
                void api
                  .previewApply(project.manifest.id, workingSpec)
                  .then((result) => setPreview({ ...result, applied: false }))
                  .catch((err) => setError(asAppError(err)))
                  .finally(() => setBusy(false))
              }}
            >
              Review file changes
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void api
                  .applySpec(project.manifest.id, workingSpec, true)
                  .then((result) => {
                    setPreview(result)
                    return api.listSnapshots(project.manifest.id).then(setSnapshots)
                  })
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

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Recoverable snapshots</h2>
        <p className="text-sm text-muted">
          Apply and version changes write a snapshot first. Restore copies files back into the project folder.
        </p>
        {snapshots.length === 0 ? <p className="text-sm">No apply / version snapshots yet.</p> : null}
        <ul className="space-y-2 text-sm">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="flex flex-wrap items-center justify-between gap-2 border border-line p-2">
              <span>
                {snapshot.reason} · {snapshot.minecraftVersion} · {snapshot.fileCount} files · {snapshot.createdAt}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void api
                    .restoreSnapshot(project.manifest.id, snapshot.id)
                    .then(() => api.getSpec(project.manifest.id).then((loaded) => specHistory.replaceCurrent(loaded)))
                    .catch((err) => setError(asAppError(err)))
                    .finally(() => setBusy(false))
                }}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {adapter ? (
        <Card>
          <h2 className="text-lg font-semibold">Adapter capabilities</h2>
          <p className="mt-2 text-sm text-muted">
            Gradle emission: {adapter.capabilities.gradleProject}. Client entities: {adapter.capabilities.clientEntities}.
            Custom items: {adapter.capabilities.customItems}. Custom blocks: {adapter.capabilities.customBlocks}.
            Custom entities: {adapter.capabilities.customEntities}. GUIs: {adapter.capabilities.customGuis}. Worldgen:{' '}
            {adapter.capabilities.worldgen}. Recipes: {adapter.capabilities.recipes}.
          </p>
        </Card>
      ) : null}
    </div>
  )
}
