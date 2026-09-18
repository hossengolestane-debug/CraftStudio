import { useCallback, useEffect, useState } from 'react'
import type { AppErrorPayload } from '../../shared/errors'
import type { AppDefaults } from '../../shared/ipc'
import type {
  AppSettings,
  CreateProjectInput,
  PlatformAdapterInfo,
  ProjectRecord,
  ProjectSummary
} from '../../shared/types'
import { AppShell, type PrimaryView, type WorkspaceTab } from './components/AppShell'
import { ErrorPanel } from './components/ErrorPanel'
import { asAppError } from './lib/errors'
import { AssetsPage } from './pages/AssetsPage'
import { CreateWizard } from './pages/CreateWizard'
import { ProjectsPage } from './pages/ProjectsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkspacePage } from './pages/WorkspacePage'

const api = window.craftstudio

export default function App() {
  const [view, setView] = useState<PrimaryView>('projects')
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('design')
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [openProject, setOpenProject] = useState<ProjectRecord | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [defaults, setDefaults] = useState<AppDefaults | null>(null)
  const [adapters, setAdapters] = useState<PlatformAdapterInfo[]>([])
  const [bootError, setBootError] = useState<AppErrorPayload | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshProjects = useCallback(async () => {
    setProjects(await api.listProjects())
  }, [])

  const refreshSettings = useCallback(async () => {
    setSettings(await api.getSettings())
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [nextProjects, nextSettings, nextDefaults, nextAdapters] = await Promise.all([
          api.listProjects(),
          api.getSettings(),
          api.getAppDefaults(),
          api.listAdapters()
        ])
        if (cancelled) {
          return
        }
        setProjects(nextProjects)
        setSettings(nextSettings)
        setDefaults(nextDefaults)
        setAdapters(nextAdapters)
      } catch (error) {
        if (!cancelled) {
          setBootError(asAppError(error))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        return
      }
      const map: Record<string, PrimaryView> = {
        '1': 'projects',
        '2': 'create',
        '3': 'assets',
        '4': 'settings'
      }
      const next = map[event.key]
      if (next) {
        event.preventDefault()
        setView(next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openById = async (id: string): Promise<void> => {
    setBusy(true)
    try {
      const record = await api.openProject(id)
      setOpenProject(record)
      setWorkspaceTab('design')
      setView('projects')
      await refreshSettings()
    } finally {
      setBusy(false)
    }
  }

  const createProject = async (input: CreateProjectInput): Promise<ProjectRecord> => {
    const record = await api.createProject(input)
    await refreshProjects()
    return record
  }

  const showWorkspace = view === 'projects' && openProject !== null

  return (
    <AppShell
      view={view}
      onViewChange={setView}
      project={openProject}
      workspaceTab={workspaceTab}
      onWorkspaceTabChange={(tab) => {
        setWorkspaceTab(tab)
        setView('projects')
      }}
    >
      {bootError ? <ErrorPanel error={bootError} /> : null}

      {view === 'create' ? (
        <CreateWizard
          adapters={adapters}
          onCreated={createProject}
          onOpenCreated={(record) => {
            void api.openProject(record.manifest.id).then(async (opened) => {
              setOpenProject(opened)
              setWorkspaceTab('design')
              setView('projects')
              await refreshSettings()
              await refreshProjects()
            })
          }}
        />
      ) : null}

      {view === 'assets' ? <AssetsPage /> : null}

      {view === 'settings' ? (
        <SettingsPage
          settings={settings}
          defaults={defaults}
          onSave={async (patch) => {
            const next = await api.updateSettings(patch)
            setSettings(next)
            await refreshProjects()
          }}
          onCheckOllama={(endpoint) => api.checkOllama(endpoint)}
          onCancelOllama={() => api.cancelOllamaCheck()}
          onBrowse={() => api.selectDirectory()}
        />
      ) : null}

      {view === 'projects' && !showWorkspace ? (
        <ProjectsPage
          projects={projects}
          openProject={openProject}
          busy={busy}
          onCreate={() => setView('create')}
          onOpen={openById}
          onRename={async (id, name) => {
            const record = await api.updateProject(id, { name })
            if (openProject?.manifest.id === id) {
              setOpenProject(record)
            }
            await refreshProjects()
          }}
          onDelete={async (id) => {
            await api.deleteProject(id)
            if (openProject?.manifest.id === id) {
              setOpenProject(null)
            }
            await refreshProjects()
            await refreshSettings()
          }}
          onRefresh={refreshProjects}
        />
      ) : null}

      {view === 'projects' && showWorkspace && openProject ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setOpenProject(null)}
            >
              Back to project list
            </button>
          </div>
          <WorkspacePage
            project={openProject}
            tab={workspaceTab}
            adapters={adapters}
            settings={settings}
            onSave={async (id, input) => {
              const record = await api.updateProject(id, input)
              setOpenProject(record)
              await refreshProjects()
            }}
            onSettingsPatch={async (patch) => {
              const next = await api.updateSettings(patch)
              setSettings(next)
            }}
          />
        </div>
      ) : null}
    </AppShell>
  )
}
