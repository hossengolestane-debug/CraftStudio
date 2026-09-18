import { BrowserWindow, dialog, ipcMain } from 'electron'
import { listAdapters } from '../shared/adapters/registry'
import { listCompatibility, lookupCompatibility } from '../shared/compatibility'
import { toAppError } from '../shared/errors'
import { IPC_CHANNELS, type CompatibilityLookupInput, type IpcResult } from '../shared/ipc'
import type { CreateProjectInput, SettingsPatch, UpdateProjectInput } from '../shared/types'
import { DEFAULT_OLLAMA_ENDPOINT } from '../shared/types'
import { OllamaService } from './services/ollamaService'
import { ProjectService } from './services/projectService'
import { SettingsService } from './services/settingsService'

function wrap<T>(run: () => Promise<T> | T): Promise<IpcResult<T>> {
  return Promise.resolve()
    .then(run)
    .then((data) => ({ ok: true as const, data }))
    .catch((error: unknown) => {
      const appError = toAppError(error)
      return { ok: false as const, error: appError.toPayload() }
    })
}

export function registerIpc(deps: {
  settings: SettingsService
  projects: ProjectService
  ollama: OllamaService
}): void {
  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST, () => wrap(() => deps.projects.list()))

  ipcMain.handle(IPC_CHANNELS.PROJECTS_CREATE, (_event, input: CreateProjectInput) =>
    wrap(() => deps.projects.create(input))
  )

  ipcMain.handle(IPC_CHANNELS.PROJECTS_GET, (_event, id: string) => wrap(() => deps.projects.get(id)))

  ipcMain.handle(IPC_CHANNELS.PROJECTS_OPEN, (_event, id: string) => wrap(() => deps.projects.open(id)))

  ipcMain.handle(IPC_CHANNELS.PROJECTS_UPDATE, (_event, id: string, input: UpdateProjectInput) =>
    wrap(() => deps.projects.update(id, input))
  )

  ipcMain.handle(IPC_CHANNELS.PROJECTS_DELETE, (_event, id: string) => wrap(() => deps.projects.delete(id)))

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => wrap(() => deps.settings.get()))

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_event, patch: SettingsPatch) =>
    wrap(() => deps.settings.update(patch))
  )

  ipcMain.handle(IPC_CHANNELS.OLLAMA_CHECK, async (_event, endpoint?: string) =>
    wrap(async () => {
      const settings = await deps.settings.get()
      return deps.ollama.check(endpoint ?? settings.ollamaEndpoint, settings.ollamaTimeoutMs)
    })
  )

  ipcMain.handle(IPC_CHANNELS.OLLAMA_CANCEL, () =>
    wrap(() => {
      deps.ollama.cancel()
    })
  )

  ipcMain.handle(IPC_CHANNELS.ADAPTERS_LIST, () => wrap(() => listAdapters()))

  ipcMain.handle(IPC_CHANNELS.COMPATIBILITY_LOOKUP, (_event, input: CompatibilityLookupInput) =>
    wrap(() => lookupCompatibility(input.platform, input.minecraftVersion))
  )

  ipcMain.handle(IPC_CHANNELS.COMPATIBILITY_LIST, (_event, platform) =>
    wrap(() => listCompatibility(platform))
  )

  ipcMain.handle(IPC_CHANNELS.APP_DEFAULTS, () =>
    wrap(() => ({
      defaultProjectsPath: deps.settings.defaultProjectsPath(),
      homeProjectsPath: deps.settings.homeProjectsPath(),
      defaultOllamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
    }))
  )

  ipcMain.handle(IPC_CHANNELS.APP_SELECT_DIRECTORY, (event) =>
    wrap(async () => {
      const window = BrowserWindow.fromWebContents(event.sender)
      const result = window
        ? await dialog.showOpenDialog(window, {
            title: 'Choose projects folder',
            properties: ['openDirectory', 'createDirectory']
          })
        : await dialog.showOpenDialog({
            title: 'Choose projects folder',
            properties: ['openDirectory', 'createDirectory']
          })
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0] ?? null
    })
  )
}
