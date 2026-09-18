import type { KeyboardEvent, ReactNode } from 'react'
import type { ProjectRecord } from '../../../shared/types'

export type PrimaryView = 'projects' | 'create' | 'assets' | 'settings'
export type WorkspaceTab = 'design' | 'code' | 'test' | 'export'

const PRIMARY_ITEMS: { id: PrimaryView; label: string; shortcut: string }[] = [
  { id: 'projects', label: 'Projects', shortcut: '1' },
  { id: 'create', label: 'Create', shortcut: '2' },
  { id: 'assets', label: 'Assets', shortcut: '3' },
  { id: 'settings', label: 'Settings', shortcut: '4' }
]

export function AppShell({
  view,
  onViewChange,
  project,
  workspaceTab,
  onWorkspaceTabChange,
  children
}: {
  view: PrimaryView
  onViewChange: (view: PrimaryView) => void
  project: ProjectRecord | null
  workspaceTab: WorkspaceTab
  onWorkspaceTabChange: (tab: WorkspaceTab) => void
  children: ReactNode
}) {
  const onSidebarKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const keys = PRIMARY_ITEMS.map((item) => item.id)
    const index = keys.indexOf(view)
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      onViewChange(keys[(index + 1) % keys.length] ?? 'projects')
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      onViewChange(keys[(index - 1 + keys.length) % keys.length] ?? 'projects')
    }
  }

  return (
    <div className="flex h-full bg-paper text-ink">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-text">
        <div className="border-b border-white/15 px-4 py-5">
          <p className="text-lg font-semibold tracking-tight">CraftStudio Local</p>
          <p className="mt-1 text-sm text-sidebar-muted">Phase 3 · Fabric + Paper</p>
        </div>
        <nav aria-label="Primary" className="flex flex-col gap-1 p-3" onKeyDown={onSidebarKeyDown}>
          {PRIMARY_ITEMS.map((item) => {
            const current = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-link px-3 py-2 text-left text-[15px] ${
                  current ? 'bg-white text-ink' : 'text-sidebar-text hover:bg-white/10'
                }`}
                aria-current={current ? 'page' : undefined}
                onClick={() => onViewChange(item.id)}
              >
                <span>{item.label}</span>
                <span className="sr-only">, shortcut Control {item.shortcut}</span>
              </button>
            )
          })}
        </nav>
        {project ? (
          <div className="mt-auto border-t border-white/15 p-4">
            <p className="text-xs uppercase tracking-wide text-sidebar-muted">Open project</p>
            <p className="mt-1 font-medium leading-snug">{project.manifest.name}</p>
            <p className="mt-1 text-sm text-sidebar-muted">
              {project.manifest.platform} · {project.manifest.minecraftVersion}
            </p>
          </div>
        ) : (
          <div className="mt-auto p-4 text-sm text-sidebar-muted">No project open</div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {project ? (
          <div className="border-b border-line bg-paper-raised px-6 py-3">
            <nav aria-label="Project workspace" className="flex gap-2">
              {(
                [
                  ['design', 'Design'],
                  ['code', 'Code'],
                  ['test', 'Test'],
                  ['export', 'Export']
                ] as const
              ).map(([id, label]) => {
                const current = workspaceTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    className={`px-3 py-1.5 text-sm ${
                      current ? 'bg-ink text-white' : 'border border-line bg-white text-ink hover:border-ink'
                    }`}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => {
                      onViewChange('projects')
                      onWorkspaceTabChange(id)
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </nav>
          </div>
        ) : null}
        <main id="main" className="min-h-0 flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
