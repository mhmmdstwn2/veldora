import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: (options?: any) => ipcRenderer.invoke('file:open', options),
  openFiles: (options?: any) => ipcRenderer.invoke('file:open-multiple', options),
  saveFile: (data: Uint8Array, defaultName: string) =>
    ipcRenderer.invoke('file:save', { data, defaultName }),
  readRecentFiles: () => ipcRenderer.invoke('file:read-recent'),
  addRecentFile: (item: { name: string; path: string; size: number; pageCount: number }) =>
    ipcRenderer.invoke('file:add-recent', item),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Auto-updater controls
  getAppVersion: () => ipcRenderer.invoke('updater:get-version'),
  getUpdaterStatus: () => ipcRenderer.invoke('updater:get-status'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback: (status: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('updater:status', listener)
    return () => {
      ipcRenderer.removeListener('updater:status', listener)
    }
  },
})

