import { useState } from 'react'
import type { AppErrorPayload } from '../../../../shared/errors'
import type { ExportResultDto } from '../../../../shared/ipc'
import { isCodegenSupported } from '../../../../shared/platformPins'
import type { ProjectRecord } from '../../../../shared/types'
import { ErrorPanel } from '../../components/ErrorPanel'
import { Badge, Button, Card } from '../../components/ui'
import { asAppError } from '../../lib/errors'

const api = window.craftstudio

export function ExportView({ project }: { project: ProjectRecord }) {
  const supported = isCodegenSupported(project.manifest.platform, project.manifest.minecraftVersion)
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ExportResultDto | null>(null)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Export</h1>
        <p className="mt-1 text-muted">
          Source ZIP is always available after files exist. JAR export requires a real successful Gradle build on disk.
        </p>
      </div>
      {error ? <ErrorPanel error={error} onDismiss={() => setError(null)} /> : null}

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{project.manifest.platform}</Badge>
          <Badge>{project.manifest.minecraftVersion}</Badge>
        </div>
        <h2 className="text-lg font-semibold">Source ZIP</h2>
        <p className="text-sm">
          Packs the project tree (skips <code>.gradle</code>, <code>build</code>, <code>run</code>). Paths are confined
          to the project folder before zipping.
        </p>
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setError(null)
            void api
              .exportSourceZip(project.manifest.id)
              .then(setResult)
              .catch((err) => setError(asAppError(err)))
              .finally(() => setBusy(false))
          }}
        >
          Export source ZIP
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Built JAR</h2>
        <p className="text-sm">
          Copies Fabric remapJar or the Paper plugin jar from <code>build/libs</code> after a successful build. This
          will not invent a jar from a model reply.
        </p>
        <Button
          disabled={busy || !supported}
          onClick={() => {
            setBusy(true)
            setError(null)
            void api
              .exportBuiltJar(project.manifest.id)
              .then(setResult)
              .catch((err) => setError(asAppError(err)))
              .finally(() => setBusy(false))
          }}
        >
          Export built JAR
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Resource pack</h2>
        <p className="text-sm">
          Not implemented. Paper custom items do not ship a resource pack. Fabric uses a placeholder flint item model.
          This button stays disabled on purpose.
        </p>
        <button type="button" disabled className="border border-line px-3 py-2 text-muted">
          Export resource pack (not yet)
        </button>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">Installation notes</h2>
        {project.manifest.platform === 'fabric' ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Install Minecraft {project.manifest.minecraftVersion} and Fabric Loader + Fabric API.</li>
            <li>Build, then drop the exported jar (not -sources) into <code>.minecraft/mods</code>.</li>
            <li>Accept the Minecraft EULA yourself. CraftStudio does not distribute game files.</li>
          </ol>
        ) : project.manifest.platform === 'paper' ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Run a Paper {project.manifest.minecraftVersion} server you downloaded yourself.</li>
            <li>Put the plugin jar in <code>plugins/</code>. Do not install it on Spigot.</li>
            <li>Clients see vanilla paper + PDC unless they add their own resource pack.</li>
            <li>Accept Minecraft/Paper terms yourself. <code>run-paper/eula.txt</code> stays <code>eula=false</code>.</li>
          </ol>
        ) : (
          <p className="text-sm">No export notes for this adapter. Generation is not implemented.</p>
        )}
        <p className="text-sm text-muted">See INSTALL.md in the generated project for the same steps.</p>
      </Card>

      {result ? (
        <p role="status">
          {result.message} ({result.fileCount} file{result.fileCount === 1 ? '' : 's'})
        </p>
      ) : null}
    </div>
  )
}
