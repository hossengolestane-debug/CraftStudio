import type { AppSettings, PlatformAdapterInfo, ProjectRecord } from '../../../shared/types'
import type { WorkspaceTab } from '../components/AppShell'
import { CodeTreeView } from './workspace/CodeTreeView'
import { DesignGenerate } from './workspace/DesignGenerate'
import { TestBuildView } from './workspace/TestBuildView'

export function WorkspacePage({
  project,
  tab,
  adapters,
  settings,
  onSave
}: {
  project: ProjectRecord
  tab: WorkspaceTab
  adapters: PlatformAdapterInfo[]
  settings: AppSettings | null
  onSave: (id: string, input: { name?: string; description?: string }) => Promise<void>
}) {
  const adapter = adapters.find((item) => item.id === project.manifest.platform)

  if (tab === 'code') {
    return <CodeTreeView project={project} />
  }

  if (tab === 'test') {
    return <TestBuildView project={project} adapter={adapter} />
  }

  return (
    <DesignGenerate project={project} adapter={adapter} settings={settings} onSaved={onSave} />
  )
}
