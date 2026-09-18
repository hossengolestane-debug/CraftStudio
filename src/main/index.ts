import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { BrowserWindow, app, shell } from 'electron'
import { registerIpc } from './ipc'
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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#141414',
    title: 'CraftStudio Local',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  console.log('CraftStudio Local main process ready')
  electronApp.setAppUserModelId('local.craftstudio')

  const settings = new SettingsService({ userDataPath: app.getPath('userData') })
  const projects = new ProjectService(settings)
  const ollama = new OllamaService()
  const generation = new GenerationService(projects, settings, ollama)
  const gradle = new GradleService()
  const evidence = new EvidenceService(app.getPath('userData'))
  registerIpc({ settings, projects, ollama, generation, gradle, evidence })

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
