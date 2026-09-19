import { useEffect, useState } from 'react'
import type { AppErrorPayload } from '../../../../shared/errors'
import type { ProjectFileNodeDto } from '../../../../shared/ipc'
import type { ProjectRecord } from '../../../../shared/types'
import { MonacoEditor } from '../../components/MonacoEditor'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Button, Card } from '../../components/ui'
import { asAppError } from '../../lib/errors'

const api = window.craftstudio

export function CodeTreeView({ project }: { project: ProjectRecord }) {
  const [tree, setTree] = useState<ProjectFileNodeDto[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [contents, setContents] = useState('')
  const [draft, setDraft] = useState('')
  const [binary, setBinary] = useState(false)
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const dirty = Boolean(selected) && !binary && draft !== contents

  useEffect(() => {
    void api
      .listProjectFiles(project.manifest.id)
      .then(setTree)
      .catch((err) => setError(asAppError(err)))
  }, [project.manifest.id])

  const reload = (): void => {
    void api
      .listProjectFiles(project.manifest.id)
      .then(setTree)
      .catch((err) => setError(asAppError(err)))
  }

  const openFile = (path: string): void => {
    setSelected(path)
    setNote(null)
    if (path.endsWith('.png') || path.endsWith('.jar')) {
      setBinary(true)
      setContents('')
      setDraft('')
      return
    }
    setBinary(false)
    void api
      .readProjectFile(project.manifest.id, path)
      .then((file) => {
        setContents(file.contents)
        setDraft(file.contents)
      })
      .catch((err) => setError(asAppError(err)))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Code</h1>
          <p className="mt-1 text-muted">
            Monaco is bound to the generated tree. Edits are preserved on regenerate (you will see a diff). Apply from
            Design still uses trusted templates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!dirty || !selected}
            onClick={() => {
              if (!selected) return
              void api
                .writeProjectFile(project.manifest.id, selected, draft)
                .then((result) => {
                  setContents(draft)
                  setNote(`Saved ${result.relativePath} (${result.bytes} bytes).`)
                  reload()
                })
                .catch((err) => setError(asAppError(err)))
            }}
          >
            Save file
          </Button>
          <Button variant="secondary" onClick={reload}>
            Reload tree
          </Button>
        </div>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}
      {note ? <p role="status">{note}</p> : null}
      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <Card className="max-h-[36rem] overflow-auto text-sm">
          {tree.length === 0 ? <p className="text-muted">No files yet. Generate from Design first.</p> : null}
          <FileList nodes={tree} selected={selected} onOpen={openFile} />
        </Card>
        <Card className="min-h-[36rem] overflow-hidden p-0">
          <p className="border-b border-line px-4 py-2 text-sm text-muted">
            {selected ?? 'Select a file'}
            {dirty ? ' · unsaved' : ''}
          </p>
          {binary ? (
            <p className="p-4 text-sm">Binary file. Edit PNGs on the Assets tab.</p>
          ) : selected ? (
            <MonacoEditor path={selected} value={draft} onChange={setDraft} />
          ) : (
            <p className="p-4 text-sm text-muted">Select a generated source file.</p>
          )}
        </Card>
      </div>
    </div>
  )
}

function FileList({
  nodes,
  selected,
  onOpen
}: {
  nodes: ProjectFileNodeDto[]
  selected: string | null
  onOpen: (path: string) => void
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={node.relativePath}>
          {node.type === 'directory' ? (
            <div>
              <p className="font-medium">{node.name}/</p>
              <div className="ml-3">
                <FileList nodes={node.children ?? []} selected={selected} onOpen={onOpen} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={`block w-full px-1 text-left ${selected === node.relativePath ? 'bg-[#ecece8]' : ''}`}
              onClick={() => onOpen(node.relativePath)}
            >
              {node.name}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
