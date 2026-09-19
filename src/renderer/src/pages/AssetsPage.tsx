import { useEffect, useState } from 'react'
import type { AppErrorPayload } from '../../../shared/errors'
import type { ProjectSpec } from '../../../shared/spec'
import type { ProjectRecord } from '../../../shared/types'
import { ErrorPanel } from '../components/ErrorPanel'
import { Card } from '../components/ui'
import { asAppError } from '../lib/errors'
import { TextureEditor } from './workspace/TextureEditor'

const api = window.craftstudio

export function AssetsPage({ project }: { project: ProjectRecord | null }) {
  const [spec, setSpec] = useState<ProjectSpec | null>(null)
  const [error, setError] = useState<AppErrorPayload | null>(null)

  useEffect(() => {
    if (!project) {
      setSpec(null)
      return
    }
    void api
      .getSpec(project.manifest.id)
      .then(setSpec)
      .catch((err) => setError(asAppError(err)))
  }, [project])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="mt-1 text-muted">
          Paint or import item and block textures, then export a resource pack from the Export tab. Paths stay inside
          the open project.
        </p>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}
      {!project ? (
        <Card>
          <p>
            Open a project to edit textures. The editor writes <code>craftstudio/textures/&lt;id&gt;.png</code> for
            items and cube-all blocks.
          </p>
        </Card>
      ) : (
        <TextureEditor project={project} spec={spec} />
      )}
    </div>
  )
}
