import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { BrowserWindow, app, shell } from 'electron'
import { IPC_EVENTS } from '../shared/ipc'
import { registerIpc } from './ipc'
import { ActivityService } from './services/activityService'
import { EvidenceService } from './services/evidenceService'
import { GenerationService } from './services/generationService'
import { GradleService } from './services/gradleService'
import { OllamaService } from './services/ollamaService'
import { ProjectService } from './services/projectService'
import { SettingsService } from './services/settingsService'

if (process.platform === 'linux' && (process.env.CI === 'true' || process.env.CRAFTSTUDIO_NO_SANDBOX === '1')) {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('no-zygote')
  app.commandLine.appendSwitch('disable-setuid-sandbox')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
  app.commandLine.appendSwitch('disable-gpu')
  app.disableHardwareAcceleration()
}

function windowPreferences(): Electron.WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    spellcheck: false
  }
}

function loadRenderer(window: BrowserWindow, hash?: string): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    const url = hash ? `${process.env.ELECTRON_RENDERER_URL}#${hash}` : process.env.ELECTRON_RENDERER_URL
    void window.loadURL(url)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#141414',
    title: 'CraftStudio Local',
    webPreferences: windowPreferences()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRenderer(mainWindow)
  return mainWindow
}

let activityWindow: BrowserWindow | null = null

function openActivityWindow(): void {
  if (activityWindow && !activityWindow.isDestroyed()) {
    activityWindow.focus()
    return
  }
  activityWindow = new BrowserWindow({
    width: 880,
    height: 720,
    minWidth: 520,
    minHeight: 360,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f4f1',
    title: 'CraftStudio Live Activity',
    webPreferences: windowPreferences()
  })
  activityWindow.on('ready-to-show', () => {
    activityWindow?.show()
  })
  activityWindow.on('closed', () => {
    activityWindow = null
  })
  activityWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  loadRenderer(activityWindow, '/activity')
}

app.whenReady().then(() => {
  console.log('CraftStudio Local main process ready')
  electronApp.setAppUserModelId('local.craftstudio')

  const settings = new SettingsService({ userDataPath: app.getPath('userData') })
  const projects = new ProjectService(settings)
  const ollama = new OllamaService()
  const activity = new ActivityService(app.getPath('userData'))
  const generation = new GenerationService(projects, settings, ollama, activity)
  const gradle = new GradleService()
  const evidence = new EvidenceService(app.getPath('userData'))

  activity.subscribe((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_EVENTS.ACTIVITY, event)
      }
    }
  })

  registerIpc({
    settings,
    projects,
    ollama,
    generation,
    gradle,
    evidence,
    activity,
    openActivityWindow
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
