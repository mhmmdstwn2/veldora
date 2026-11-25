import { ipcMain, BrowserWindow } from 'electron'

export function registerWindowIpc(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('window:minimize', () => {
    const win = getWindow()
    if (win) win.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    const win = getWindow()
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
  })

  ipcMain.handle('window:close', () => {
    const win = getWindow()
    if (win) win.close()
  })
}

