import { ipcMain, BrowserWindow } from 'electron'
import { FileSystemService } from '../services/filesystem.service'

export function registerFileIpc(getWindow: () => BrowserWindow | null, fsService: FileSystemService) {
  ipcMain.handle('file:open', async (_, options?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
    const win = getWindow()
    if (!win) return null
    return fsService.openFileDialog(win, options)
  })

  ipcMain.handle('file:open-multiple', async (_, options?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
    const win = getWindow()
    if (!win) return []
    return fsService.openFilesDialog(win, options)
  })

  ipcMain.handle('file:save', async (_, { data, defaultName }) => {
    const win = getWindow()
    if (!win) return false
    return fsService.saveFileDialog(win, data, defaultName)
  })

  ipcMain.handle('file:read-recent', async () => {
    return fsService.readRecentFiles()
  })

  ipcMain.handle('file:add-recent', async (_, item) => {
    return fsService.addRecentFile(item)
  })
}

