import { app, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export class FileSystemService {
  private recentFilePath: string

  constructor() {
    this.recentFilePath = path.join(app.getPath('userData'), 'veldora_recent.json')
  }

  async openFileDialog(window: BrowserWindow, options?: { filters?: Array<{ name: string; extensions: string[] }> }) {
    const filters = options?.filters || [
      { name: 'PDF Documents', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ]
    const res = await dialog.showOpenDialog(window, {
      title: 'Open Document',
      properties: ['openFile'],
      filters,
    })

    if (res.canceled || res.filePaths.length === 0) return null
    const filePath = res.filePaths[0]
    const buffer = fs.readFileSync(filePath)
    const stats = fs.statSync(filePath)

    return {
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      data: buffer,
    }
  }

  async openFilesDialog(window: BrowserWindow, options?: { filters?: Array<{ name: string; extensions: string[] }> }) {
    const filters = options?.filters || [
      { name: 'PDF Documents', extensions: ['pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ]
    const res = await dialog.showOpenDialog(window, {
      title: 'Open Multiple Documents',
      properties: ['openFile', 'multiSelections'],
      filters,
    })

    if (res.canceled || res.filePaths.length === 0) return []

    return res.filePaths.map((filePath) => {
      const buffer = fs.readFileSync(filePath)
      const stats = fs.statSync(filePath)
      return {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        data: buffer,
      }
    })
  }

  async saveFileDialog(window: BrowserWindow, data: Uint8Array, defaultName: string) {
    const ext = defaultName.split('.').pop()?.toLowerCase() || ''
    let filterName = 'PDF Document'
    let extensions = ['pdf']

    if (ext === 'zip') {
      filterName = 'ZIP Archive'
      extensions = ['zip']
    } else if (ext === 'docx') {
      filterName = 'Microsoft Word'
      extensions = ['docx']
    } else if (ext === 'xlsx') {
      filterName = 'Microsoft Excel'
      extensions = ['xlsx']
    } else if (ext === 'csv') {
      filterName = 'CSV Document'
      extensions = ['csv']
    } else if (ext === 'png') {
      filterName = 'PNG Image'
      extensions = ['png']
    } else if (ext === 'jpg' || ext === 'jpeg') {
      filterName = 'JPEG Image'
      extensions = ['jpg', 'jpeg']
    }

    const res = await dialog.showSaveDialog(window, {
      title: `Save ${filterName}`,
      defaultPath: defaultName,
      filters: [
        { name: filterName, extensions },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (res.canceled || !res.filePath) return false
    fs.writeFileSync(res.filePath, Buffer.from(data))
    return true
  }

  async readRecentFiles() {
    try {
      if (!fs.existsSync(this.recentFilePath)) return []
      const content = fs.readFileSync(this.recentFilePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return []
    }
  }

  async addRecentFile(item: { name: string; path: string; size: number; pageCount: number }) {
    try {
      const current = await this.readRecentFiles()
      const filtered = current.filter((x: any) => x.path !== item.path)
      const newItem = {
        id: Math.random().toString(36).substring(2, 9),
        ...item,
        lastOpened: new Date().toISOString(),
      }
      const updated = [newItem, ...filtered].slice(0, 15)
      fs.writeFileSync(this.recentFilePath, JSON.stringify(updated, null, 2), 'utf-8')
    } catch (e) {
      console.error('Failed to update recent files', e)
    }
  }
}

