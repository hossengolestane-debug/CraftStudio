import { useEffect, useState } from 'react'
import type { AppErrorPayload } from '../../../../shared/errors'
import type { ProjectFileNodeDto } from '../../../../shared/ipc'
import type { ProjectRecord } from '../../../../shared/types'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Button, Card } from '../../components/ui'
import { asAppError } from '../../lib/errors'

const api = window.craftstudio

export function CodeTreeView({ project }: { project: ProjectRecord }) {
  const [tree, setTree] = useState<ProjectFileNodeDto[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [contents, setContents] = useState('')
  const [error, setError] = useState<AppErrorPayload | null>(null)

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

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Code</h1>
          <p className="mt-1 text-muted">
            Read-only tree of generated files. Monaco is optional and not required in Phase 3.
          </p>
        </div>
        <Button variant="secondary" onClick={reload}>
          Reload tree
        </Button>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}
      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <Card className="max-h-[32rem] overflow-auto text-sm">
          {tree.length === 0 ? <p className="text-muted">No files yet. Generate from Design first.</p> : null}
          <FileList
            nodes={tree}
            selected={selected}
            onOpen={(path) => {
              setSelected(path)
              void api
                .readProjectFile(project.manifest.id, path)
                .then((file) => setContents(file.contents))
                .catch((err) => setError(asAppError(err)))
            }}
          />
        </Card>
        <Card className="max-h-[32rem] overflow-auto">
          <p className="text-sm text-muted">{selected ?? 'Select a file'}</p>
          <pre className="mt-3 whitespace-pre-wrap text-[13px] leading-5">{contents}</pre>
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
