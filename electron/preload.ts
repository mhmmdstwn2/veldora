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

  // Live Share (LAN Form & Review)
  liveShareStartHost: (pdfBytes: Uint8Array, docName: string) =>
    ipcRenderer.invoke('live-share:start-host', { pdfBytes, docName }),
  liveShareUpdatePdf: (pdfBytes: Uint8Array, docName?: string) =>
    ipcRenderer.invoke('live-share:update-pdf', { pdfBytes, docName }),
  liveShareStopHost: () => ipcRenderer.invoke('live-share:stop-host'),
  liveShareGetHostStatus: () => ipcRenderer.invoke('live-share:get-host-status'),
  liveShareStartDiscovery: () => ipcRenderer.invoke('live-share:start-discovery'),
  liveShareStopDiscovery: () => ipcRenderer.invoke('live-share:stop-discovery'),
  liveShareJoin: (pairId: string) => ipcRenderer.invoke('live-share:join', pairId),
  liveShareLeave: () => ipcRenderer.invoke('live-share:leave'),
  onLiveShareHostStatus: (callback: (status: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('live-share:host-status', listener)
    return () => ipcRenderer.removeListener('live-share:host-status', listener)
  },
  onLiveShareClientStatus: (callback: (status: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('live-share:client-status', listener)
    return () => ipcRenderer.removeListener('live-share:client-status', listener)
  },
  onLiveShareDiscovered: (callback: (hosts: any[]) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('live-share:discovered', listener)
    return () => ipcRenderer.removeListener('live-share:discovered', listener)
  },
  onLiveSharePdfReceived: (callback: (data: { pdfBytes: Uint8Array; docName: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('live-share:pdf-received', listener)
    return () => ipcRenderer.removeListener('live-share:pdf-received', listener)
  },

  // System Fonts (Offline Full Font Support)
  listSystemFonts: () => ipcRenderer.invoke('fonts:list-system'),
  readSystemFont: (filePath: string) => ipcRenderer.invoke('fonts:read-file', filePath),
})

