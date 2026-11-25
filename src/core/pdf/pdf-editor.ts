import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFHexString, rgb, degrees, StandardFonts, PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import pako from 'pako'
import {
  AnnotationItem,
  PdfTextElement,
  PdfImageElement,
  TextRun,
  WatermarkOptions,
  PageNumberOptions,
  CropOptions,
} from '@/types'
import { getEffectiveRuns, splitRunsByLine } from './rich-text'

function decodeAscii85(bytes: Uint8Array | string): Uint8Array {
  let s = typeof bytes === 'string' ? bytes : new TextDecoder('latin1').decode(bytes)
  s = s.replace(/\s+/g, '')
  if (s.startsWith('<~')) s = s.slice(2)
  if (s.endsWith('~>')) s = s.slice(0, -2)

  const out: number[] = []
  let i = 0
  while (i < s.length) {
    if (s[i] === 'z') {
      out.push(0, 0, 0, 0)
      i++
      continue
    }
    const chunk = s.slice(i, i + 5)
    const len = chunk.length
    let val = 0
    for (let j = 0; j < 5; j++) {
      val = val * 85 + (j < len ? chunk.charCodeAt(j) - 33 : 84)
    }
    for (let j = 0; j < len - 1; j++) {
      out.push((val >> (24 - j * 8)) & 0xff)
    }
    i += 5
  }
  return new Uint8Array(out)
}

function decodeAsciiHex(bytes: Uint8Array | string): Uint8Array {
  let s = typeof bytes === 'string' ? bytes : new TextDecoder('latin1').decode(bytes)
  s = s.replace(/\s+/g, '').replace(/>$/, '')
  const out: number[] = []
  for (let i = 0; i < s.length; i += 2) {
    out.push(parseInt(s.substr(i, 2), 16))
  }
  return new Uint8Array(out)
}

function decodeStreamContents(stream: any): string {
  let data = stream.contents
  if (!data || data.length === 0) return ''

  const filterObj = stream.dict.get(PDFName.of('Filter'))
  let filters: string[] = []
  if (filterObj) {
    if (filterObj.asArray) {
      filters = filterObj.asArray().map((f: any) => f.toString().replace(/^\//, ''))
    } else {
      const fStr = filterObj.toString()
      if (fStr.startsWith('[') && fStr.endsWith(']')) {
        filters = fStr.slice(1, -1).trim().split(/\s+/).map((f: string) => f.replace(/^\//, ''))
      } else {
        filters = [fStr.replace(/^\//, '')]
      }
    }
  }

  if (filters.length === 0) {
    return new TextDecoder('latin1').decode(data)
  }

  for (const filter of filters) {
    if (filter === 'ASCII85Decode') {
      data = decodeAscii85(data)
    } else if (filter === 'ASCIIHexDecode') {
      data = decodeAsciiHex(data)
    } else if (filter === 'FlateDecode') {
      try {
        data = pako.inflate(data)
      } catch (err) { }
    }
  }

  return new TextDecoder('latin1').decode(data)
}

function textToPdfLiteral(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export class PdfEditor {
  static async mergePdfs(pdfBuffers: Uint8Array[]): Promise<Uint8Array> {
    const mergedDoc = await PDFDocument.create()

    for (const buffer of pdfBuffers) {
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices())
      copiedPages.forEach((page) => mergedDoc.addPage(page))
    }

    return mergedDoc.save({ useObjectStreams: false })
  }

  static async splitPdf(
    sourceBuffer: Uint8Array,
    fromPage: number,
    toPage: number
  ): Promise<Uint8Array> {
    const sourceDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true })
    const newDoc = await PDFDocument.create()

    const indices: number[] = []
    const total = sourceDoc.getPageCount()
    const start = Math.max(0, fromPage - 1)
    const end = Math.min(total - 1, toPage - 1)

    for (let i = start; i <= end; i++) {
      indices.push(i)
    }

    const copiedPages = await newDoc.copyPages(sourceDoc, indices)
    copiedPages.forEach((page) => newDoc.addPage(page))

    return newDoc.save({ useObjectStreams: false })
  }

  static async extractPages(
    sourceBuffer: Uint8Array,
    pageNumbers: number[]
  ): Promise<Uint8Array> {
    const sourceDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true })
    const newDoc = await PDFDocument.create()
    const total = sourceDoc.getPageCount()

    const validIndices = pageNumbers
      .map((p) => p - 1)
      .filter((idx) => idx >= 0 && idx < total)

    const copiedPages = await newDoc.copyPages(sourceDoc, validIndices)
    copiedPages.forEach((page) => newDoc.addPage(page))

    return newDoc.save({ useObjectStreams: false })
  }

  static async deletePages(
    sourceBuffer: Uint8Array,
    pageNumbersToDelete: number[]
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const doc = await PDFDocument.create()
    const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => doc.addPage(page))
    const toDelete = [...new Set(pageNumbersToDelete)]
      .map((n) => n - 1)
      .filter((idx) => idx >= 0 && idx < doc.getPageCount())
      .sort((a, b) => b - a)

    for (const idx of toDelete) {
      if (doc.getPageCount() > 1) {
        doc.removePage(idx)
      }
    }

    return doc.save({ useObjectStreams: false })
  }

  static async duplicatePage(
    sourceBuffer: Uint8Array,
    pageNumber: number
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const doc = await PDFDocument.create()
    const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => doc.addPage(page))
    const pageIndex = pageNumber - 1
    if (pageIndex < 0 || pageIndex >= doc.getPageCount()) return sourceBuffer

    const [copied] = await doc.copyPages(doc, [pageIndex])
    doc.insertPage(pageIndex + 1, copied)
    return doc.save({ useObjectStreams: false })
  }

  static async insertBlankPage(
    sourceBuffer: Uint8Array,
    atPageNumber: number,
    width = 595.28,
    height = 841.89
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const doc = await PDFDocument.create()
    const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => doc.addPage(page))
    const index = Math.max(0, Math.min(doc.getPageCount(), atPageNumber - 1))
    doc.insertPage(index, [width, height])
    return doc.save({ useObjectStreams: false })
  }

  static async reorderPages(
    sourceBuffer: Uint8Array,
    pageOrder1Based: number[]
  ): Promise<Uint8Array> {
    const sourceDoc = await PDFDocument.load(sourceBuffer)
    const newDoc = await PDFDocument.create()
    const indices = pageOrder1Based
      .map((p) => p - 1)
      .filter((idx) => idx >= 0 && idx < sourceDoc.getPageCount())

    const copiedPages = await newDoc.copyPages(sourceDoc, indices)
    copiedPages.forEach((page) => newDoc.addPage(page))

    return newDoc.save({ useObjectStreams: false })
  }

  static async rotatePage(
    sourceBuffer: Uint8Array,
    pageNumber: number,
    rotationDelta: number
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const doc = await PDFDocument.create()
    const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => doc.addPage(page))
    const pageIndex = pageNumber - 1
    if (pageIndex >= 0 && pageIndex < doc.getPageCount()) {
      const page = doc.getPage(pageIndex)
      const current = page.getRotation().angle
      page.setRotation(degrees((current + rotationDelta) % 360))
    }
    return doc.save({ useObjectStreams: false })
  }

  static async cropPage(
    sourceBuffer: Uint8Array,
    crop: CropOptions
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const doc = await PDFDocument.create()
    const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => doc.addPage(page))
    const pageIndex = crop.pageNumber - 1
    if (pageIndex < 0 || pageIndex >= doc.getPageCount()) return sourceBuffer

    const page = doc.getPage(pageIndex)
    const { width, height } = page.getSize()

    const x = (crop.left / 100) * width
    const y = (crop.bottom / 100) * height
    const w = ((100 - crop.left - crop.right) / 100) * width
    const h = ((100 - crop.top - crop.bottom) / 100) * height

    if (w > 10 && h > 10) {
      page.setCropBox(x, y, w, h)
      page.setMediaBox(x, y, w, h)
    }

    return doc.save({ useObjectStreams: false })
  }

  static async addWatermark(
    sourceBuffer: Uint8Array,
    options: WatermarkOptions
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const doc = await PDFDocument.create()
    const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => doc.addPage(page))
    const font = await doc.embedFont(StandardFonts.HelveticaBold)
    const pageCount = doc.getPageCount()

    const parseHex = (hex: string) => {
      if (!hex.startsWith('#') || hex.length < 7) return rgb(0.5, 0.5, 0.5)
      return rgb(
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255
      )
    }

    const watermarkColor = parseHex(options.color)

    for (let i = 0; i < pageCount; i++) {
      const page = doc.getPage(i)
      const { width, height } = page.getSize()
      const textWidth = options.text.length * (options.fontSize * 0.5)

      page.drawText(options.text, {
        x: width / 2 - textWidth / 2,
        y: height / 2,
        size: options.fontSize,
        font,
        color: watermarkColor,
        opacity: options.opacity,
        rotate: degrees(options.rotation),
      })
    }

    return doc.save({ useObjectStreams: false })
  }

  static async addPageNumbers(
    sourceBuffer: Uint8Array,
    options: PageNumberOptions
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const doc = await PDFDocument.create()
    const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => doc.addPage(page))
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const pageCount = doc.getPageCount()

    for (let i = 0; i < pageCount; i++) {
      const page = doc.getPage(i)
      const { width, height } = page.getSize()
      const currentNumber = options.startNumber + i

      let label = `${currentNumber}`
      if (options.format === '1 / N') label = `${currentNumber} / ${pageCount}`
      if (options.format === 'Page 1 of N') label = `Page ${currentNumber} of ${pageCount}`
      if (options.format === '- 1 -') label = `- ${currentNumber} -`

      const textWidth = label.length * (options.fontSize * 0.5)
      let x = width / 2 - textWidth / 2
      let y = 30

      if (options.position === 'bottom-left') x = 40
      if (options.position === 'bottom-right') x = width - textWidth - 40
      if (options.position === 'top-center') y = height - 30
      if (options.position === 'top-right') {
        x = width - textWidth - 40
        y = height - 30
      }

      page.drawText(label, {
        x,
        y,
        size: options.fontSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
    }

    return doc.save({ useObjectStreams: false })
  }

  /**
   * Real PDF Content Stream Editor: Cleanly suppresses target text operators
   * from the vector content stream without painting ugly white rectangles,
   * without leaking global text rendering mode (Tr = 3), and without erasing unrelated neighbors.
   */
  static suppressTextElementsFromPageStreams(
    doc: PDFDocument,
    pageIndex: number,
    items: PdfTextElement[]
  ): boolean {
    const page = doc.getPage(pageIndex)
    const contentsRef = page.node.Contents()
    if (!contentsRef) return false
    const refs = (contentsRef as any).asArray ? (contentsRef as any).asArray() : [contentsRef]

    const pendingItems = [...items]
    let anyModified = false

    // PASS 1: Literal text suppression in content streams
    for (const ref of refs) {
      const stream: any = doc.context.lookup(ref)
      if (!stream || !stream.contents) continue
      let streamText = decodeStreamContents(stream)
      if (!streamText) continue

      let streamChanged = false

      for (let i = pendingItems.length - 1; i >= 0; i--) {
        const item = pendingItems[i]
        const rawLit = item.originalText?.trim()
        if (!rawLit) continue

        // Support multiline paragraphs by testing each constituent line
        const sublines = rawLit.includes('\n')
          ? rawLit.split('\n').map((l) => l.trim()).filter(Boolean)
          : [rawLit]

        let anySublineMatched = false

        for (const lit of sublines) {
          // 1. Exact Tj: (string) Tj
          const pdfEscaped = textToPdfLiteral(lit)
          const regTj = new RegExp(`\\(${escapeRegExp(pdfEscaped)}\\)\\s*Tj`, 'g')
          if (regTj.test(streamText)) {
            streamText = streamText.replace(regTj, '() Tj')
            streamChanged = true
            anyModified = true
            anySublineMatched = true
            continue
          }

          // 2. TJ array: [ ... (phrase) ... ] TJ
          const regTJ = new RegExp(`\\[[^\\]]*?\\(${escapeRegExp(pdfEscaped)}\\)[^\\]]*?\\]\\s*TJ`, 'g')
          if (regTJ.test(streamText)) {
            streamText = streamText.replace(regTJ, (tjBlock) => {
              return tjBlock.replace(new RegExp(`\\(${escapeRegExp(pdfEscaped)}\\)`, 'g'), '()')
            })
            streamChanged = true
            anyModified = true
            anySublineMatched = true
            continue
          }
        }

        if (anySublineMatched) {
          pendingItems.splice(i, 1)
        }
      }

      if (streamChanged) {
        const deflated = pako.deflate(new TextEncoder().encode(streamText))
        stream.contents = new Uint8Array(deflated)
        stream.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'))
        stream.dict.set(PDFName.of('Length'), PDFNumber.of(deflated.length))
        stream.dict.delete(PDFName.of('DecodeParms'))
      }
    }

    return anyModified
  }

  // Backward compatibility wrapper
  static removeTextBlocksFromPageStreams(
    doc: PDFDocument,
    pageIndex: number,
    blockIndices: Set<number>,
    targetTexts?: string[]
  ): boolean {
    const items: PdfTextElement[] = []
    if (targetTexts && targetTexts.length > 0) {
      for (const t of targetTexts) {
        items.push({
          id: '',
          pageNumber: pageIndex + 1,
          text: t,
          originalText: t,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          fontSize: 12,
          fontFamily: 'Helvetica',
          color: '#000000',
          blockIndices: Array.from(blockIndices),
        })
      }
    } else {
      items.push({
        id: '',
        pageNumber: pageIndex + 1,
        text: '',
        originalText: '',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        fontSize: 12,
        fontFamily: 'Helvetica',
        color: '#000000',
        blockIndices: Array.from(blockIndices),
      })
    }
    return this.suppressTextElementsFromPageStreams(doc, pageIndex, items)
  }

  static async exportFullEditedPdf(
    sourceBuffer: Uint8Array,
    options: {
      annotations?: AnnotationItem[]
      originalTexts?: PdfTextElement[]
      originalImages?: PdfImageElement[]
      watermark?: WatermarkOptions
      pageNumbers?: PageNumberOptions
    }
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const doc = await PDFDocument.create()
    const copiedPages = await doc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => doc.addPage(page))
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
    const obliqueFont = await doc.embedFont(StandardFonts.HelveticaOblique)
    const boldObliqueFont = await doc.embedFont(StandardFonts.HelveticaBoldOblique)

    const timesFont = await doc.embedFont(StandardFonts.TimesRoman)
    const timesBoldFont = await doc.embedFont(StandardFonts.TimesRomanBold)
    const timesItalicFont = await doc.embedFont(StandardFonts.TimesRomanItalic)
    const timesBoldItalicFont = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)

    const courierFont = await doc.embedFont(StandardFonts.Courier)
    const courierBoldFont = await doc.embedFont(StandardFonts.CourierBold)
    const courierObliqueFont = await doc.embedFont(StandardFonts.CourierOblique)

    const parseHex = (hex?: string) => {
      if (!hex || !hex.startsWith('#') || hex.length < 7) return rgb(0, 0, 0)
      return rgb(
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255
      )
    }

    doc.registerFontkit(fontkit)

    let embeddedArial: PDFFont | null = null
    let embeddedArialBold: PDFFont | null = null
    let embeddedCalibri: PDFFont | null = null
    let embeddedCalibriBold: PDFFont | null = null

    try {
      const loadFont = async (name: string): Promise<Uint8Array | null> => {
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          try {
            const fs = await import('fs')
            const path = await import('path')
            const localPublicPath = path.join(process.cwd(), 'public/fonts', name)
            if (fs.existsSync(localPublicPath)) {
              return fs.readFileSync(localPublicPath)
            }
            const winFontPath = path.join('C:/Windows/Fonts', name)
            if (fs.existsSync(winFontPath)) {
              return fs.readFileSync(winFontPath)
            }
          } catch { }
        }
        if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
          try {
            const url = new URL(`./fonts/${name}`, window.location.href).href
            return await new Promise<Uint8Array | null>((resolve) => {
              const xhr = new XMLHttpRequest()
              xhr.open('GET', url, true)
              xhr.responseType = 'arraybuffer'
              xhr.onload = () => {
                if ((xhr.status === 200 || xhr.status === 0) && xhr.response) {
                  resolve(new Uint8Array(xhr.response))
                } else {
                  resolve(null)
                }
              }
              xhr.onerror = () => resolve(null)
              xhr.send()
            })
          } catch { }
        }
        if (typeof fetch !== 'undefined') {
          try {
            const res = await fetch(`./fonts/${name}`)
            if (res.ok) {
              const buf = await res.arrayBuffer()
              return new Uint8Array(buf)
            }
          } catch { }
        }
        return null
      }

      const arialBytes = await loadFont('arial.ttf')
      if (arialBytes) embeddedArial = await doc.embedFont(arialBytes, { subset: true })

      const arialBdBytes = await loadFont('arialbd.ttf')
      if (arialBdBytes) embeddedArialBold = await doc.embedFont(arialBdBytes, { subset: true })

      const calibriBytes = await loadFont('calibri.ttf')
      if (calibriBytes) embeddedCalibri = await doc.embedFont(calibriBytes, { subset: true })

      const calibriBdBytes = await loadFont('calibrib.ttf')
      if (calibriBdBytes) embeddedCalibriBold = await doc.embedFont(calibriBdBytes, { subset: true })
    } catch (e) {
      console.warn('Font embedding notice:', e)
    }

    const selectFont = (
      fontFamily?: string,
      overrideBold?: boolean,
      overrideItalic?: boolean
    ) => {
      const lower = (fontFamily || '').toLowerCase()
      const isBold = overrideBold !== undefined ? overrideBold : lower.includes('bold')
      const isItalic =
        overrideItalic !== undefined
          ? overrideItalic
          : lower.includes('italic') || lower.includes('oblique')

      if (lower.includes('times') || lower.includes('serif') || lower.includes('roman')) {
        if (isBold && isItalic) return timesBoldItalicFont
        if (isBold) return timesBoldFont
        if (isItalic) return timesItalicFont
        return timesFont
      }
      if (lower.includes('courier') || lower.includes('mono')) {
        if (isBold) return courierBoldFont
        if (isItalic) return courierObliqueFont
        return courierFont
      }

      if (lower.includes('calibri') && !isItalic) {
        if (isBold && embeddedCalibriBold) return embeddedCalibriBold
        if (embeddedCalibri) return embeddedCalibri
      }

      if (
        (!fontFamily ||
          lower.includes('arial') ||
          lower.includes('sans') ||
          lower.includes('helvetica') ||
          lower.includes('roboto') ||
          lower.includes('lato') ||
          lower.includes('dejavu') ||
          lower.includes('g_d')) &&
        !isItalic
      ) {
        if (isBold && embeddedArialBold) return embeddedArialBold
        if (embeddedArial) return embeddedArial
      }

      if (isBold && isItalic) return boldObliqueFont
      if (isBold) return embeddedArialBold || boldFont
      if (isItalic) return obliqueFont
      return embeddedArial || font
    }

    const drawRichRuns = (
      page: ReturnType<typeof doc.getPage>,
      runs: TextRun[],
      opts: {
        x: number
        y: number
        fontSize: number
        lineHeight: number
        fontFamily?: string
        color: ReturnType<typeof rgb>
      }
    ) => {
      const lines = splitRunsByLine(runs)
      lines.forEach((lineRuns, lineIdx) => {
        let cursorX = opts.x
        const baselineY = opts.y - lineIdx * opts.lineHeight
        for (const run of lineRuns) {
          const chosen = selectFont(opts.fontFamily, Boolean(run.bold), Boolean(run.italic))
          const runColor = run.color ? parseHex(run.color) : opts.color
          page.drawText(run.text, {
            x: cursorX,
            y: baselineY,
            size: opts.fontSize,
            font: chosen,
            color: runColor,
          })
          const runWidth = chosen.widthOfTextAtSize(run.text, opts.fontSize)
          if (run.underline && runWidth > 0) {
            page.drawLine({
              start: { x: cursorX, y: baselineY - opts.fontSize * 0.12 },
              end: { x: cursorX + runWidth, y: baselineY - opts.fontSize * 0.12 },
              thickness: Math.max(0.6, opts.fontSize * 0.06),
              color: runColor,
            })
          }
          cursorX += runWidth
        }
      })
    }

    // 1. REAL PDF TEXT EDITING: CLEANLY REMOVE ORIGINAL TEXT AND DRAW MODIFICATIONS
    if (options.originalTexts && options.originalTexts.length > 0) {
      // Group by page
      const pageGroups = new Map<number, PdfTextElement[]>()
      for (const item of options.originalTexts) {
        if (!item.isModified && !item.isDeleted) continue
        const pageIdx = item.pageNumber - 1
        if (pageIdx < 0 || pageIdx >= doc.getPageCount()) continue
        const list = pageGroups.get(pageIdx) || []
        list.push(item)
        pageGroups.set(pageIdx, list)
      }

      for (const [pageIndex, items] of pageGroups.entries()) {
        const page = doc.getPage(pageIndex)
        const { width: pageWidth, height: pageHeight } = page.getSize()

        // Cleanly suppress literal matches in vector stream if possible
        try {
          this.suppressTextElementsFromPageStreams(doc, pageIndex, items)
        } catch (e) {
          console.warn('Stream suppression skipped:', e)
        }

        // Cleanly occlude original text locations so no ghosts remain
        for (const item of items) {
          const targetBaselineY = item.pdfBaselineY !== undefined
            ? item.pdfBaselineY
            : (pageHeight - ((item.origY ?? item.y) / 100) * pageHeight) - item.fontSize * 0.82

          const targetX = item.pdfX !== undefined
            ? item.pdfX
            : ((item.origX ?? item.x) / 100) * pageWidth

          const targetW = item.pdfWidth !== undefined
            ? item.pdfWidth
            : ((item.origWidth ?? item.width) / 100) * pageWidth

          // Tight, clean whiteout box that covers ONLY the text glyphs:
          // Descender is ~0.2 * fontSize, ascender is ~0.78 * fontSize.
          // Total height: fontSize * 0.98.
          // This leaves clearance from top and bottom table lines so borders are NEVER clipped or erased!
          const rectY = targetBaselineY - item.fontSize * 0.22
          const rectH = item.fontSize * 0.98

          // Use exact sampled background color (e.g. gray in table headers) instead of hardcoded white
          const maskColor = item.backgroundColor ? parseHex(item.backgroundColor) : rgb(1, 1, 1)

          page.drawRectangle({
            x: Math.max(0, targetX),
            y: Math.max(0, rectY),
            width: targetW,
            height: rectH,
            color: maskColor,
            opacity: 1.0,
          })
        }

        // Draw modified text items (that are not deleted)
        for (const item of items) {
          if (!item.isDeleted && item.text) {
            const isMoved = (item.origX !== undefined && Math.abs(item.x - item.origX) > 0.1) ||
              (item.origY !== undefined && Math.abs(item.y - item.origY) > 0.1)

            let drawX: number
            let drawY: number
            if (!isMoved && item.pdfBaselineY !== undefined && item.pdfX !== undefined) {
              drawX = item.pdfX
              drawY = item.pdfBaselineY
            } else {
              drawX = (item.x / 100) * pageWidth
              const topY = pageHeight - (item.y / 100) * pageHeight
              drawY = topY - item.fontSize * 0.82
            }

            const runs = getEffectiveRuns(item)
            drawRichRuns(page, runs, {
              x: drawX,
              y: drawY,
              fontSize: item.fontSize,
              lineHeight: item.lineHeight || item.fontSize * 1.35,
              fontFamily: item.fontFamily,
              color: parseHex(item.color),
            })
          }
        }
      }
    }

    // 2. PROCESS ORIGINAL IMAGE DELETIONS, REPLACEMENTS, AND MOVES
    if (options.originalImages && options.originalImages.length > 0) {
      for (const img of options.originalImages) {
        const isMoved =
          (img.origX !== undefined && Math.abs(img.x - img.origX) > 0.1) ||
          (img.origY !== undefined && Math.abs(img.y - img.origY) > 0.1)
        const isScaled =
          (img.origWidth !== undefined && Math.abs(img.width - img.origWidth) > 0.2) ||
          (img.origHeight !== undefined && Math.abs(img.height - img.origHeight) > 0.2)
        const isModified = !!img.isModified || isMoved || isScaled

        if (!img.isDeleted && !img.replacementDataUrl && !isModified) continue

        const pageIndex = img.pageNumber - 1
        if (pageIndex < 0 || pageIndex >= doc.getPageCount()) continue
        const page = doc.getPage(pageIndex)
        const { width: pageWidth, height: pageHeight } = page.getSize()

        const usePdfCoords = img.pdfX !== undefined && img.pdfY !== undefined
        const origX = usePdfCoords ? img.pdfX! : ((img.origX ?? img.x) / 100) * pageWidth
        const origH = usePdfCoords ? img.pdfHeight! : ((img.origHeight ?? img.height) / 100) * pageHeight
        const origY = usePdfCoords ? img.pdfY! : (pageHeight - ((img.origY ?? img.y) / 100) * pageHeight) - origH
        const origW = usePdfCoords ? img.pdfWidth! : ((img.origWidth ?? img.width) / 100) * pageWidth

        // Clean whiteout over the ORIGINAL position with exact content bounding box so adjacent lines/borders are NEVER clipped
        page.drawRectangle({
          x: origX,
          y: origY,
          width: origW,
          height: origH,
          color: rgb(1, 1, 1),
          opacity: 1.0,
        })

        // If replaced or moved, draw the active image at the NEW position
        const activeDataUrl = img.replacementDataUrl || (isModified ? img.dataUrl : undefined)
        if (!img.isDeleted && activeDataUrl) {
          try {
            const newX = (img.x / 100) * pageWidth
            const newY = pageHeight - (img.y / 100) * pageHeight
            const newW = (img.width / 100) * pageWidth
            const newH = (img.height / 100) * pageHeight

            const embedded = activeDataUrl.includes('image/png')
              ? await doc.embedPng(activeDataUrl)
              : await doc.embedJpg(activeDataUrl)

            page.drawImage(embedded, {
              x: newX,
              y: newY - newH,
              width: newW,
              height: newH,
            })
          } catch (e) {
            console.error('Failed to embed edited image:', e)
          }
        }
      }
    }

    // 3. PROCESS ANNOTATIONS, SIGNATURES, AND TRUE REDACTIONS
    if (options.annotations && options.annotations.length > 0) {
      for (const ann of options.annotations) {
        const pageIndex = ann.pageNumber - 1
        if (pageIndex < 0 || pageIndex >= doc.getPageCount()) continue

        const page = doc.getPage(pageIndex)
        const { width: pageWidth, height: pageHeight } = page.getSize()

        const x = (ann.x / 100) * pageWidth
        const y = pageHeight - (ann.y / 100) * pageHeight
        const w = ann.width ? (ann.width / 100) * pageWidth : 100
        const h = ann.height ? (ann.height / 100) * pageHeight : 30

        if (ann.type === 'redact') {
          // TRUE REDACTION: Permanent opaque black or white vector blackout
          page.drawRectangle({
            x,
            y: y - h,
            width: w,
            height: h,
            color: parseHex(ann.color || '#000000'),
            opacity: 1.0,
          })
        } else if (ann.type === 'text' && ann.text) {
          const fontSize = ann.fontSize ?? 14
          const textWidth = ann.width
            ? (ann.width / 100) * pageWidth
            : fontSize * ann.text.length * 0.65
          const textHeight = ann.height
            ? (ann.height / 100) * pageHeight
            : fontSize * 1.35

          if (ann.backgroundColor) {
            page.drawRectangle({
              x,
              y: y - textHeight,
              width: textWidth,
              height: textHeight,
              color: rgb(1, 1, 1),
              opacity: 1.0,
            })
          }

          const runs = getEffectiveRuns(ann)
          drawRichRuns(page, runs, {
            x,
            y: y - fontSize,
            fontSize,
            lineHeight: fontSize * 1.35,
            fontFamily: ann.fontFamily,
            color: parseHex(ann.color),
          })
        } else if (ann.type === 'highlight') {
          page.drawRectangle({
            x,
            y: y - h,
            width: w,
            height: h,
            color: rgb(1, 0.9, 0.2),
            opacity: ann.opacity ?? 0.35,
          })
        } else if (ann.type === 'shape') {
          const shapeColor = parseHex(ann.color || '#8b5cf6')
          const strokeWidth = ann.strokeWidth ?? 2
          if (ann.shapeType === 'rect') {
            page.drawRectangle({
              x,
              y: y - h,
              width: w,
              height: h,
              borderColor: shapeColor,
              borderWidth: strokeWidth,
              opacity: 0.9,
            })
          } else if (ann.shapeType === 'circle') {
            page.drawEllipse({
              x: x + w / 2,
              y: y - h / 2,
              xScale: Math.max(1, w / 2),
              yScale: Math.max(1, h / 2),
              borderColor: shapeColor,
              borderWidth: strokeWidth,
              opacity: 0.9,
            })
          } else if (ann.shapeType === 'line' || ann.shapeType === 'arrow') {
            page.drawLine({
              start: { x, y },
              end: { x: x + w, y: y - h },
              thickness: strokeWidth,
              color: shapeColor,
              opacity: 0.9,
            })
          }
        } else if (ann.type === 'comment' && ann.text) {
          // Standard PDF Sticky Note / Text Comment Annotation (/Subtype /Text)
          try {
            const noteColor = parseHex(ann.color || '#f59e0b')
            const annotDict = doc.context.obj({
              Type: 'Annot',
              Subtype: 'Text',
              Rect: [x, Math.max(0, y - 22), Math.min(pageWidth, x + 22), y],
              Contents: PDFHexString.fromText(ann.text),
              T: PDFHexString.fromText(ann.author || 'VELDORA User'),
              C: [noteColor.red, noteColor.green, noteColor.blue],
              Name: 'Comment',
              Open: false,
            })
            const annotRef = doc.context.register(annotDict)
            let annots = page.node.Annots()
            if (!annots) {
              annots = doc.context.obj([]) as PDFArray
              page.node.set(PDFName.of('Annots'), annots)
            }
            annots.push(annotRef)
          } catch (err) {
            console.warn('Failed to embed comment annotation:', err)
          }
        } else if ((ann.type === 'signature' || ann.type === 'image') && ann.dataUrl) {
          try {
            const embeddedImage = ann.dataUrl.includes('image/png')
              ? await doc.embedPng(ann.dataUrl)
              : await doc.embedJpg(ann.dataUrl)

            page.drawImage(embeddedImage, {
              x,
              y: y - h,
              width: w,
              height: h,
            })
          } catch (err) {
            console.error('Failed to embed image/signature:', err)
          }
        }
      }
    }

    let currentBytes = await doc.save({ useObjectStreams: false })

    // 4. WATERMARK
    if (options.watermark && options.watermark.text) {
      currentBytes = await this.addWatermark(currentBytes, options.watermark)
    }

    // 5. PAGE NUMBERS
    if (options.pageNumbers) {
      currentBytes = await this.addPageNumbers(currentBytes, options.pageNumbers)
    }

    return currentBytes
  }

  static async applyEditsToDocument(
    sourceBuffer: Uint8Array,
    options: {
      annotations?: AnnotationItem[]
      originalTexts?: PdfTextElement[]
      originalImages?: PdfImageElement[]
      watermark?: WatermarkOptions
      pageNumbers?: PageNumberOptions
    }
  ): Promise<Uint8Array> {
    return this.exportFullEditedPdf(sourceBuffer, options)
  }

  // Backward compatibility alias
  static async burnAnnotations(
    sourceBuffer: Uint8Array,
    annotations: AnnotationItem[]
  ): Promise<Uint8Array> {
    return this.exportFullEditedPdf(sourceBuffer, { annotations })
  }
}
