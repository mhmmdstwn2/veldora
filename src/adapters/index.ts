import { DocumentInfo, RecentDocument } from '@/types'
import { WebAdapter } from './web/web-adapter'
import { DesktopAdapter } from './desktop/desktop-adapter'

export interface IFileAdapter {
  isDesktop(): boolean
  openFile(options?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<DocumentInfo | null>
  openFiles(options?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<DocumentInfo[]>
  saveFile(data: Uint8Array, defaultName: string): Promise<boolean>
  downloadFile(data: Uint8Array, defaultName: string): Promise<boolean>
  readRecentFiles(): Promise<RecentDocument[]>
  addRecentFile(item: { name: string; path?: string; size: number; pageCount: number }): Promise<void>
}

let activeAdapter: IFileAdapter | null = null

export function getFileAdapter(): IFileAdapter {
  if (activeAdapter) return activeAdapter

  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI
  if (isElectron) {
    activeAdapter = new DesktopAdapter()
  } else {
    activeAdapter = new WebAdapter()
  }
  return activeAdapter
}
