import { app, ipcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

export interface UpdaterStatusPayload {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'dev-mode'
  version?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  message?: string
  manual?: boolean
}

let isInitialized = false
let isManualCheck = false
let lastStatus: UpdaterStatusPayload = { status: 'idle', version: app.getVersion() }

function broadcastStatus(getWindow: () => BrowserWindow | null, payload: UpdaterStatusPayload) {
  lastStatus = payload
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('updater:status', payload)
  }
}

export function registerUpdaterIpc(
  getWindow: () => BrowserWindow | null,
  logDebug: (msg: string) => void
) {
  if (!isInitialized) {
    isInitialized = true
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false

    autoUpdater.on('checking-for-update', () => {
      logDebug('AutoUpdater: checking-for-update')
      broadcastStatus(getWindow, {
        status: 'checking',
        version: app.getVersion(),
        manual: isManualCheck,
      })
    })

    autoUpdater.on('update-available', (info) => {
      logDebug(`AutoUpdater: update-available -> v${info.version}`)
      broadcastStatus(getWindow, {
        status: 'available',
        version: info.version,
        manual: isManualCheck,
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      logDebug(`AutoUpdater: update-not-available (current v${info.version})`)
      broadcastStatus(getWindow, {
        status: 'not-available',
        version: info.version,
        manual: isManualCheck,
      })
      isManualCheck = false
    })

    autoUpdater.on('download-progress', (progress) => {
      broadcastStatus(getWindow, {
        status: 'downloading',
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
        version: lastStatus.version,
        manual: isManualCheck,
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      logDebug(`AutoUpdater: update-downloaded -> v${info.version}`)
      broadcastStatus(getWindow, {
        status: 'downloaded',
        version: info.version,
        percent: 100,
        manual: isManualCheck,
      })
      isManualCheck = false
    })

    autoUpdater.on('error', (err) => {
      const msg = err?.message || String(err)
      logDebug(`AutoUpdater error (manual=${isManualCheck}): ${msg}`)
      // Never disturb offline users during automatic background startup checks
      if (isManualCheck) {
        broadcastStatus(getWindow, {
          status: 'error',
          version: app.getVersion(),
          message: msg.includes('ERR_INTERNET_DISCONNECTED') || msg.includes('ENOTFOUND') || msg.includes('net::')
            ? 'Tidak dapat terhubung ke GitHub. Periksa koneksi internet Anda.'
            : msg.includes('404') || msg.includes('No published versions')
              ? 'Belum ada rilis pembaruan yang dipublikasikan di GitHub Releases.'
              : `Gagal memeriksa update: ${msg}`,
          manual: true,
        })
      } else {
        broadcastStatus(getWindow, { status: 'idle', version: app.getVersion() })
      }
      isManualCheck = false
    })
  }

  ipcMain.handle('updater:get-version', () => app.getVersion())
  ipcMain.handle('updater:get-status', () => lastStatus)

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      const devPayload: UpdaterStatusPayload = {
        status: 'dev-mode',
        version: app.getVersion(),
        message: 'Mode pengembangan (unpacked dev): Auto-update aktif pada installer produksi (.exe).',
        manual: true,
      }
      broadcastStatus(getWindow, devPayload)
      return devPayload
    }

    isManualCheck = true
    try {
      await autoUpdater.checkForUpdates()
      return lastStatus
    } catch (err: any) {
      return lastStatus
    }
  })

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) return false
    await autoUpdater.downloadUpdate()
    return true
  })

  ipcMain.handle('updater:install', () => {
    logDebug('AutoUpdater: quitting and installing update...')
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true)
    })
  })
}

export async function triggerStartupUpdateCheck(logDebug: (msg: string) => void) {
  if (!app.isPackaged) {
    logDebug('AutoUpdater: skipped startup check (not packaged)')
    return
  }
  isManualCheck = false
  try {
    await autoUpdater.checkForUpdates()
  } catch (err: any) {
    logDebug(`AutoUpdater silent startup check notice: ${err?.message || err}`)
  }
}
