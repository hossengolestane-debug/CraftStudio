import { useMemo, useState } from 'react'
import type { AppErrorPayload } from '../../../shared/errors'
import type { AppSettings, ProjectRecord, ProjectSummary } from '../../../shared/types'
import { ErrorPanel } from '../components/ErrorPanel'
import { FirstRunChecklist } from '../components/FirstRunChecklist'
import { Badge, Button, Card, TextInput } from '../components/ui'
import { asAppError } from '../lib/errors'

export function ProjectsPage({
  projects,
  openProject,
  settings,
  busy,
  onCreate,
  onOpen,
  onRename,
  onDelete,
  onRefresh
}: {
  projects: ProjectSummary[]
  openProject: ProjectRecord | null
  settings: AppSettings | null
  busy: boolean
  onCreate: () => void
  onOpen: (id: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return projects
    }
    return projects.filter((project) =>
      `${project.name} ${project.description} ${project.platform} ${project.minecraftVersion}`
        .toLowerCase()
        .includes(needle)
    )
  }, [projects, query])

  const recent = useMemo(() => {
    const lastId = settings?.lastOpenedProjectId
    const byUpdated = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const last = lastId ? projects.find((project) => project.id === lastId) : undefined
    const rest = byUpdated.filter((project) => project.id !== lastId).slice(0, 4)
    return last ? [last, ...rest] : byUpdated.slice(0, 5)
  }, [projects, settings?.lastOpenedProjectId])

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-1 text-muted">Local folders with a CraftStudio manifest. Nothing is uploaded.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </Button>
          <Button onClick={onCreate}>Create project</Button>
        </div>
      </div>

      <FirstRunChecklist settings={settings} />

      {recent.length > 0 ? (
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold">Recent</h2>
          <p className="text-sm text-muted">Last opened plus newest by updated time.</p>
          <ul className="flex flex-wrap gap-2">
            {recent.map((project) => (
              <li key={`recent-${project.id}`}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    void onOpen(project.id).catch((err) => setError(asAppError(err)))
                  }}
                >
                  {project.name} · {project.platform} {project.minecraftVersion}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}

      <TextInput
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by name, platform, or version"
        aria-label="Filter projects"
      />

      {filtered.length === 0 ? (
        <Card>
          <p className="font-medium">No projects yet.</p>
          <p className="mt-2 text-muted">
            Create a mod or plugin to write a real folder and `craftstudio.project.json` under your projects root.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((project) => {
            const isOpen = openProject?.manifest.id === project.id
            return (
              <li key={project.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{project.name}</h2>
                        <Badge>{project.type}</Badge>
                        <Badge>{project.platform}</Badge>
                        <Badge tone="neutral">{project.minecraftVersion}</Badge>
                        {isOpen ? <Badge tone="ok">Open</Badge> : null}
                      </div>
                      <p className="mt-2 text-muted">{project.description || 'No description'}</p>
                      <p className="mt-2 text-sm text-muted">Updated {new Date(project.updatedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          void onOpen(project.id).catch((err) => setError(asAppError(err)))
                        }}
                        disabled={busy}
                      >
                        Open
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setRenamingId(project.id)
                          setRenameValue(project.name)
                        }}
                        disabled={busy}
                      >
                        Rename
                      </Button>
                      <Button variant="danger" onClick={() => setPendingDelete(project)} disabled={busy}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  {renamingId === project.id ? (
                    <form
                      className="mt-4 flex flex-wrap gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void onRename(project.id, renameValue)
                          .then(() => setRenamingId(null))
                          .catch((err) => setError(asAppError(err)))
                      }}
                    >
                      <TextInput
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        aria-label="New project name"
                        maxLength={80}
                      />
                      <Button type="submit">Save name</Button>
                      <Button type="button" variant="ghost" onClick={() => setRenamingId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {pendingDelete ? (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-md border border-ink bg-white p-5"
          >
            <h2 id="delete-title" className="text-lg font-semibold">
              Delete {pendingDelete.name}?
            </h2>
            <p className="mt-2 text-muted">
              This removes the project folder from disk. A create-time snapshot cannot bring it back after delete.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  void onDelete(pendingDelete.id)
                    .then(() => setPendingDelete(null))
                    .catch((err) => {
                      setError(asAppError(err))
                      setPendingDelete(null)
                    })
                }}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
