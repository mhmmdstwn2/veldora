import { app, BrowserWindow, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { FileSystemService } from './services/filesystem.service'
import { registerFileIpc } from './ipc/file.ipc'
import { registerWindowIpc } from './ipc/window.ipc'
import { registerUpdaterIpc, triggerStartupUpdateCheck } from './ipc/updater.ipc'
import { registerLiveShareIpc } from './ipc/live-share.ipc'

const logFile = path.join(app.getPath('userData'), 'veldora_debug.log')
function logDebug(msg: string) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`)
  } catch {}
}

logDebug('Electron starting...')

process.on('uncaughtException', (error) => {
  logDebug(`UNCAUGHT EXCEPTION: ${error.stack || error}`)
  dialog.showErrorBox('Veldora Error', `${error.stack || error}`)
})

let mainWindow: BrowserWindow | null = null

function createWindow() {
  logDebug('Creating window...')
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true, // Standard or custom titlebar
    title: 'VELDORA - Professional PDF Editor',
    backgroundColor: '#0c0d10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  const fsService = new FileSystemService()
  registerFileIpc(() => mainWindow, fsService)
  registerWindowIpc(() => mainWindow)
  registerUpdaterIpc(() => mainWindow, logDebug)
  registerLiveShareIpc(() => mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    logDebug(`Loading URL: ${process.env.VITE_DEV_SERVER_URL}`)
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const htmlPath = path.join(__dirname, '../dist/index.html')
    logDebug(`Loading file: ${htmlPath}`)
    mainWindow.loadFile(htmlPath).catch((err) => {
      logDebug(`Failed to loadFile: ${err}`)
    })
  }

  mainWindow.webContents.on('did-finish-load', () => {
    logDebug('webContents did-finish-load')
    setTimeout(() => {
      triggerStartupUpdateCheck(logDebug)
    }, 4000)
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logDebug(`did-fail-load: ${code} ${desc} ${url}`)
  })

  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    logDebug(`RENDERER [lvl:${level}]: ${message} (${sourceId}:${line})`)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  logDebug('app.whenReady fired')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
}).catch((err) => {
  logDebug(`app.whenReady error: ${err.stack || err}`)
})

app.on('window-all-closed', () => {
  logDebug('window-all-closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


