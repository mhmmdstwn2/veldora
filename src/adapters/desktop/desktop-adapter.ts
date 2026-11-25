import { DocumentInfo, RecentDocument } from '@/types'
import { IFileAdapter } from '../index'

declare global {
  interface Window {
    electronAPI?: {
      openFile: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ name: string; path: string; size: number; data: Uint8Array } | null>
      openFiles: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) => Promise<Array<{ name: string; path: string; size: number; data: Uint8Array }>>
      saveFile: (data: Uint8Array, defaultName: string) => Promise<boolean>
      readRecentFiles: () => Promise<RecentDocument[]>
      addRecentFile: (item: { name: string; path: string; size: number; pageCount: number }) => Promise<void>
      getAppVersion?: () => Promise<string>
      getUpdaterStatus?: () => Promise<any>
      checkForUpdates?: () => Promise<any>
      installUpdate?: () => void
      onUpdaterStatus?: (cb: (status: any) => void) => () => void
    }
  }
}

export class DesktopAdapter implements IFileAdapter {
  isDesktop(): boolean {
    return true
  }

  async openFile(options?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<DocumentInfo | null> {
    if (!window.electronAPI) return null
    const res = await window.electronAPI.openFile(options)
    if (!res) return null
    return {
      name: res.name,
      path: res.path,
      size: res.size,
      pageCount: 1,
      data: new Uint8Array(res.data),
    }
  }

  async openFiles(options?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<DocumentInfo[]> {
    if (!window.electronAPI) return []
    const res = await window.electronAPI.openFiles(options)
    return res.map((r) => ({
      name: r.name,
      path: r.path,
      size: r.size,
      pageCount: 1,
      data: new Uint8Array(r.data),
    }))
  }

  async saveFile(data: Uint8Array, defaultName: string): Promise<boolean> {
    if (!window.electronAPI) return false
    return window.electronAPI.saveFile(data, defaultName)
  }

  async downloadFile(data: Uint8Array, defaultName: string): Promise<boolean> {
    return this.saveFile(data, defaultName)
  }

  async readRecentFiles(): Promise<RecentDocument[]> {
    if (!window.electronAPI) return []
    return window.electronAPI.readRecentFiles()
  }

  async addRecentFile(item: { name: string; path?: string; size: number; pageCount: number }): Promise<void> {
    if (!window.electronAPI || !item.path) return
    return window.electronAPI.addRecentFile({
      name: item.name,
      path: item.path,
      size: item.size,
      pageCount: item.pageCount,
    })
  }
}

