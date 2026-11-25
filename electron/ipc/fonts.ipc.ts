import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface SystemFontVariant {
  family: string
  style: 'regular' | 'bold' | 'italic' | 'boldItalic'
  fileName: string
  filePath: string
}

export interface SystemFontFamily {
  family: string
  regular?: string
  bold?: string
  italic?: string
  boldItalic?: string
}

/**
 * Lightweight TrueType/OpenType 'name' table parser to extract human-readable
 * Font Family (nameID 1 / 16) and Subfamily (nameID 2 / 17) without external deps.
 */
function parseTtfNameTable(filePath: string): { family: string; subfamily: string } | null {
  let fd: number | null = null
  try {
    fd = fs.openSync(filePath, 'r')
    const header = Buffer.alloc(12)
    fs.readSync(fd, header, 0, 12, 0)
    const numTables = header.readUInt16BE(4)
    if (numTables > 128) return null

    const tableDir = Buffer.alloc(numTables * 16)
    fs.readSync(fd, tableDir, 0, tableDir.length, 12)

    let nameOffset = 0
    let nameLength = 0
    for (let i = 0; i < numTables; i++) {
      const base = i * 16
      const tag = tableDir.toString('ascii', base, base + 4)
      if (tag === 'name') {
        nameOffset = tableDir.readUInt32BE(base + 8)
        nameLength = tableDir.readUInt32BE(base + 12)
        break
      }
    }
    if (!nameOffset || !nameLength || nameLength > 512 * 1024) return null

    const nameBuf = Buffer.alloc(nameLength)
    fs.readSync(fd, nameBuf, 0, nameLength, nameOffset)

    const count = nameBuf.readUInt16BE(2)
    const stringOffset = nameBuf.readUInt16BE(4)

    let family = ''
    let preferredFamily = ''
    let subfamily = ''
    let preferredSubfamily = ''

    for (let i = 0; i < count; i++) {
      const rec = 6 + i * 12
      if (rec + 12 > nameBuf.length) break
      const platformId = nameBuf.readUInt16BE(rec)
      const encodingId = nameBuf.readUInt16BE(rec + 2)
      const nameId = nameBuf.readUInt16BE(rec + 6)
      const len = nameBuf.readUInt16BE(rec + 8)
      const off = nameBuf.readUInt16BE(rec + 10)

      if (![1, 2, 16, 17].includes(nameId)) continue
      const start = stringOffset + off
      if (start + len > nameBuf.length) continue

      let decoded = ''
      if (platformId === 3 || platformId === 0) {
        // UTF-16BE
        const slice = Buffer.from(nameBuf.subarray(start, start + len))
        slice.swap16()
        decoded = slice.toString('utf16le').trim()
      } else if (platformId === 1 && encodingId === 0) {
        decoded = nameBuf.toString('latin1', start, start + len).trim()
      }
      if (!decoded) continue

      if (nameId === 16 && !preferredFamily) preferredFamily = decoded
      if (nameId === 1 && (!family || platformId === 3)) family = decoded
      if (nameId === 17 && !preferredSubfamily) preferredSubfamily = decoded
      if (nameId === 2 && (!subfamily || platformId === 3)) subfamily = decoded
    }

    const finalFamily = preferredFamily || family
    if (!finalFamily) return null
    return {
      family: finalFamily,
      subfamily: (preferredSubfamily || subfamily || 'Regular').toLowerCase(),
    }
  } catch {
    return null
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd)
      } catch {}
    }
  }
}

function classifyStyle(subfamily: string): SystemFontVariant['style'] {
  const isBold =
    subfamily.includes('bold') ||
    subfamily.includes('heavy') ||
    subfamily.includes('black') ||
    subfamily.includes('semibold')
  const isItalic = subfamily.includes('italic') || subfamily.includes('oblique')
  if (isBold && isItalic) return 'boldItalic'
  if (isBold) return 'bold'
  if (isItalic) return 'italic'
  return 'regular'
}

let cachedSystemFonts: SystemFontFamily[] | null = null

function scanSystemFonts(): SystemFontFamily[] {
  if (cachedSystemFonts) return cachedSystemFonts

  const fontDirs: string[] = []
  if (process.platform === 'win32') {
    const winDir = process.env.WINDIR || 'C:\\Windows'
    fontDirs.push(path.join(winDir, 'Fonts'))
    if (process.env.LOCALAPPDATA) {
      fontDirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'))
    }
  } else if (process.platform === 'darwin') {
    fontDirs.push('/System/Library/Fonts', '/Library/Fonts')
  } else {
    fontDirs.push('/usr/share/fonts', '/usr/local/share/fonts')
  }

  const map = new Map<string, SystemFontFamily>()

  for (const dir of fontDirs) {
    if (!fs.existsSync(dir)) continue
    let entries: string[] = []
    try {
      entries = fs.readdirSync(dir)
    } catch {
      continue
    }

    for (const fileName of entries) {
      const lower = fileName.toLowerCase()
      if (!lower.endsWith('.ttf') && !lower.endsWith('.otf')) continue
      const fullPath = path.join(dir, fileName)
      const parsed = parseTtfNameTable(fullPath)
      if (!parsed) continue

      const style = classifyStyle(parsed.subfamily)
      const existing = map.get(parsed.family) || { family: parsed.family }
      if (!existing[style]) {
        existing[style] = fullPath
      }
      map.set(parsed.family, existing)
    }
  }

  cachedSystemFonts = Array.from(map.values())
    .filter((f) => f.regular || f.bold || f.italic || f.boldItalic)
    .sort((a, b) => a.family.localeCompare(b.family))

  return cachedSystemFonts
}

export function registerFontsIpc() {
  ipcMain.handle('fonts:list-system', async () => {
    return scanSystemFonts()
  })

  ipcMain.handle('fonts:read-file', async (_e, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') return null
    const lower = filePath.toLowerCase()
    if (!lower.endsWith('.ttf') && !lower.endsWith('.otf')) return null
    try {
      const buf = fs.readFileSync(filePath)
      return new Uint8Array(buf)
    } catch {
      return null
    }
  })
}
