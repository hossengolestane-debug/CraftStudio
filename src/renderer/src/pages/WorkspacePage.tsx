import type { AppSettings, PlatformAdapterInfo, ProjectRecord, SettingsPatch } from '../../../shared/types'
import type { WorkspaceTab } from '../components/AppShell'
import { CodeTreeView } from './workspace/CodeTreeView'
import { DesignGenerate } from './workspace/DesignGenerate'
import { ExportView } from './workspace/ExportView'
import { TestBuildView } from './workspace/TestBuildView'

export function WorkspacePage({
  project,
  tab,
  adapters,
  settings,
  onSave,
  onSettingsPatch
}: {
  project: ProjectRecord
  tab: WorkspaceTab
  adapters: PlatformAdapterInfo[]
  settings: AppSettings | null
  onSave: (id: string, input: { name?: string; description?: string; minecraftVersion?: string }) => Promise<void>
  onSettingsPatch?: (patch: SettingsPatch) => Promise<void>
}) {
  const adapter = adapters.find((item) => item.id === project.manifest.platform)

  if (tab === 'code') {
    return <CodeTreeView project={project} />
  }

  if (tab === 'test') {
    return (
      <TestBuildView
        project={project}
        adapter={adapter}
        settings={settings}
        onAcceptTerms={
          onSettingsPatch
            ? () => onSettingsPatch({ minecraftEulaAccepted: true, runtimeTermsAcceptedAt: new Date().toISOString() })
            : undefined
        }
      />
    )
  }

  if (tab === 'export') {
    return <ExportView project={project} />
  }

  return (
    <DesignGenerate project={project} adapter={adapter} settings={settings} onSaved={onSave} />
  )
}
