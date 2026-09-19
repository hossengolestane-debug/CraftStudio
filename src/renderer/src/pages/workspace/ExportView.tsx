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
  const packSupported =
    project.manifest.platform === 'fabric' ||
    project.manifest.platform === 'paper' ||
    project.manifest.platform === 'neoforge' ||
    project.manifest.platform === 'forge' ||
    project.manifest.platform === 'spigot'
  const [error, setError] = useState<AppErrorPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ExportResultDto | null>(null)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Export</h1>
        <p className="mt-1 text-muted">
          Source ZIP is always available after files exist. JAR export requires a real successful Gradle build on disk.
          Resource packs require painted or imported item textures. A standalone datapack ZIP is loot + worldgen JSON
          only — it is not the Java mod.
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
          Copies the Fabric remapJar, NeoForge/Forge jar, or Paper/Spigot plugin jar from <code>build/libs</code> after a
          successful build. This will not invent a jar from a model reply.
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
        {project.manifest.platform === 'paper' || project.manifest.platform === 'spigot' ? (
          <p className="text-sm">
            Plugin items stay vanilla paper + CustomModelData. <strong>Every client must install this pack</strong> or
            they will still see regular paper. The plugin jar cannot register a new item id. The zip includes{' '}
            <code>pack.png</code>.
          </p>
        ) : packSupported ? (
          <p className="text-sm">
            Exports <code>pack.mcmeta</code>, <code>pack.png</code>, and item textures/models (generated or handheld,
            optional layer1 painted in Assets) under <code>assets/&lt;modid&gt;/</code>. Re-apply the spec after painting
            so the mod jar also embeds the same PNGs.
          </p>
        ) : (
          <p className="text-sm">Resource-pack export is not implemented for this adapter.</p>
        )}
        <Button
          disabled={busy || !packSupported}
          onClick={() => {
            setBusy(true)
            setError(null)
            void api
              .exportResourcePack(project.manifest.id)
              .then(setResult)
              .catch((err) => setError(asAppError(err)))
              .finally(() => setBusy(false))
          }}
        >
          Export resource pack
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Datapack ZIP</h2>
        <p className="text-sm">
          Exports <code>pack.mcmeta</code>, loot JSON, and configured/placed feature JSON. It does{' '}
          <strong>not</strong> include Java, Fabric biome injection, Forge/NeoForge biome modifiers, or GLM chest
          inject. Vanilla will not place features until you add biome JSON, or you use the Java mod. See DATAPACK.md
          inside the zip.
        </p>
        <Button
          disabled={busy || !supported}
          onClick={() => {
            setBusy(true)
            setError(null)
            void api
              .exportDatapack(project.manifest.id)
              .then(setResult)
              .catch((err) => setError(asAppError(err)))
              .finally(() => setBusy(false))
          }}
        >
          Export datapack ZIP
        </Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-semibold">Installation notes</h2>
        {project.manifest.platform === 'fabric' ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Install Minecraft {project.manifest.minecraftVersion} and Fabric Loader + Fabric API.</li>
            <li>Build, then drop the exported jar (not -sources) into <code>.minecraft/mods</code>.</li>
            <li>Optional: install the exported resource pack if you want the textures without rebuilding the jar.</li>
            <li>Accept the Minecraft EULA yourself. CraftStudio does not distribute game files.</li>
          </ol>
        ) : project.manifest.platform === 'neoforge' ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Install Minecraft {project.manifest.minecraftVersion} and the NeoForge installer — not Forge.</li>
            <li>Build, then drop the exported jar into <code>.minecraft/mods</code>.</li>
            <li>Accept the Minecraft EULA yourself. CraftStudio does not distribute game files.</li>
          </ol>
        ) : project.manifest.platform === 'forge' ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Install Minecraft {project.manifest.minecraftVersion} and the official Forge installer — not NeoForge.</li>
            <li>Build, then drop the exported jar into <code>.minecraft/mods</code>.</li>
            <li>Accept the Minecraft EULA yourself. CraftStudio does not distribute game files.</li>
          </ol>
        ) : project.manifest.platform === 'paper' || project.manifest.platform === 'spigot' ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>
              Run a {project.manifest.platform === 'paper' ? 'Paper' : 'Spigot'} {project.manifest.minecraftVersion}{' '}
              server you downloaded yourself.
            </li>
            <li>
              Put the plugin jar in <code>plugins/</code>.{' '}
              {project.manifest.platform === 'paper'
                ? 'Do not install it on Spigot.'
                : 'Do not treat this as a Paper plugin.'}
            </li>
            <li>Install the exported resource pack on every client. CustomModelData will not show otherwise.</li>
            <li>
              Accept Minecraft terms yourself.{' '}
              <code>{project.manifest.platform === 'paper' ? 'run-paper' : 'run-spigot'}/eula.txt</code> stays{' '}
              <code>eula=false</code>.
            </li>
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
