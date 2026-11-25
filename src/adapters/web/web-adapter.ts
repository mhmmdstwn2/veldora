import { DocumentInfo, RecentDocument } from '@/types'
import { IFileAdapter } from '../index'

const RECENT_KEY = 'veldora_recent_files'

export class WebAdapter implements IFileAdapter {
  isDesktop(): boolean {
    return false
  }

  async openFile(): Promise<DocumentInfo | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/pdf'
      input.onchange = async () => {
        if (!input.files || input.files.length === 0) {
          resolve(null)
          return
        }
        const file = input.files[0]
        const buffer = await file.arrayBuffer()
        const data = new Uint8Array(buffer)
        resolve({
          name: file.name,
          size: file.size,
          pageCount: 1, // Will be updated by pdfLoader
          data,
          lastModified: file.lastModified,
        })
      }
      input.click()
    })
  }

  async openFiles(): Promise<DocumentInfo[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/pdf'
      input.multiple = true
      input.onchange = async () => {
        if (!input.files || input.files.length === 0) {
          resolve([])
          return
        }
        const results: DocumentInfo[] = []
        for (let i = 0; i < input.files.length; i++) {
          const file = input.files[i]
          const buffer = await file.arrayBuffer()
          results.push({
            name: file.name,
            size: file.size,
            pageCount: 1,
            data: new Uint8Array(buffer),
            lastModified: file.lastModified,
          })
        }
        resolve(results)
      }
      input.click()
    })
  }

  async saveFile(data: Uint8Array, defaultName: string): Promise<boolean> {
    return this.downloadFile(data, defaultName)
  }

  async downloadFile(data: Uint8Array, defaultName: string): Promise<boolean> {
    try {
      const ext = defaultName.split('.').pop()?.toLowerCase() || ''
      let mimeType = 'application/octet-stream'
      if (ext === 'zip') mimeType = 'application/zip'
      else if (ext === 'pdf') mimeType = 'application/pdf'
      else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      else if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      else if (ext === 'png') mimeType = 'image/png'
      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'

      const blob = new Blob([data as unknown as BlobPart], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return true
    } catch (e) {
      console.error('Download failed:', e)
      return false
    }
  }

  async readRecentFiles(): Promise<RecentDocument[]> {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (!raw) return []
      return JSON.parse(raw) as RecentDocument[]
    } catch {
      return []
    }
  }

  async addRecentFile(item: { name: string; path?: string; size: number; pageCount: number }): Promise<void> {
    try {
      const current = await this.readRecentFiles()
      const filtered = current.filter((x) => x.name !== item.name)
      const newItem: RecentDocument = {
        id: Math.random().toString(36).substring(2, 9),
        name: item.name,
        path: item.path,
        size: item.size,
        pageCount: item.pageCount,
        lastOpened: new Date().toISOString(),
      }
      const updated = [newItem, ...filtered].slice(0, 10)
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
    } catch (e) {
      console.error('Failed to save recent files', e)
    }
  }
}

