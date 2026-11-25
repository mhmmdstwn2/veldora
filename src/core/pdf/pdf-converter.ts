import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { Document, Paragraph, TextRun, Packer } from 'docx'
import { PdfLoader } from './pdf-loader'

export interface ImageInputItem {
  data: Uint8Array
  type: 'jpeg' | 'png' | 'webp' | string
  name?: string
}

export interface SheetImageResult {
  sheetName: string
  dataUrl: string
  filename: string
}

export class PdfConverter {
  /**
   * Render PDF pages to high-res images (PNG or JPG)
   */
  static async pdfToImages(
    data: Uint8Array,
    format: 'jpg' | 'png' = 'png',
    dpiScale = 2.0
  ): Promise<Array<{ pageNumber: number; dataUrl: string; filename: string }>> {
    const pdfDoc = await PdfLoader.loadDocument(data)
    const results: Array<{ pageNumber: number; dataUrl: string; filename: string }> = []

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i)
      const viewport = page.getViewport({ scale: dpiScale })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height

      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise

      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
      const dataUrl = canvas.toDataURL(mimeType, 0.92)
      results.push({
        pageNumber: i,
        dataUrl,
        filename: `page_${i}.${format}`,
      })
    }

    return results
  }

  /**
   * Convert all PDF pages to images and bundle them into a ZIP archive
   */
  static async pdfToImagesZip(
    data: Uint8Array,
    format: 'jpg' | 'png' = 'png'
  ): Promise<Uint8Array> {
    const images = await this.pdfToImages(data, format)
    const zip = new JSZip()

    for (const img of images) {
      const base64Data = img.dataUrl.split(',')[1]
      zip.file(img.filename, base64Data, { base64: true })
    }

    return zip.generateAsync({ type: 'uint8array' })
  }

  /**
   * Convert image list to a multi-page PDF document
   */
  static async imagesToPdf(
    images: Array<{ data: Uint8Array; type: string }>
  ): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.create()

    for (const item of images) {
      const normalizedType = item.type.toLowerCase()
      let embedded: any

      if (normalizedType.includes('png')) {
        embedded = await pdfDoc.embedPng(item.data)
      } else if (normalizedType.includes('jpeg') || normalizedType.includes('jpg')) {
        embedded = await pdfDoc.embedJpg(item.data)
      } else {
        // Fallback for WebP or other formats via canvas
        const blob = new Blob([item.data as unknown as BlobPart], { type: item.type })
        const imgUrl = URL.createObjectURL(blob)
        const canvas = document.createElement('canvas')
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = imgUrl
        })
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0)
        URL.revokeObjectURL(imgUrl)

        const pngDataUrl = canvas.toDataURL('image/png')
        const base64 = pngDataUrl.split(',')[1]
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        embedded = await pdfDoc.embedPng(bytes)
      }

      const { width, height } = embedded.scale(1)
      const page = pdfDoc.addPage([width, height])
      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width,
        height,
      })
    }

    return pdfDoc.save()
  }

  /**
   * Convert PDF Document to editable Microsoft Word (.docx) document
   */
  static async pdfToWord(pdfData: Uint8Array): Promise<Uint8Array> {
    const pdfDoc = await PdfLoader.loadDocument(pdfData)
    const docSections: any[] = []

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p)
      const textContent = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1.0 })

      // Cluster text baselines within 4 points
      const lineMap = new Map<number, Array<{ x: number; text: string; fontSize: number; fontName: string }>>()
      for (const rawItem of textContent.items) {
        const item = rawItem as any
        if (!item.str || !item.str.trim()) continue
        const y = Math.round(item.transform[5] / 4) * 4
        const list = lineMap.get(y) || []
        list.push({
          x: item.transform[4],
          text: item.str,
          fontSize: Math.hypot(item.transform[0], item.transform[1]) || 12,
          fontName: item.fontName || '',
        })
        lineMap.set(y, list)
      }

      // Sort lines top-to-bottom (descending Y in PDF coordinates)
      const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
      const paragraphs: Paragraph[] = []

      for (const y of sortedYs) {
        const items = lineMap.get(y) || []
        items.sort((a, b) => a.x - b.x)

        const lineText = items.map((it) => it.text).join(' ')
        const maxFontSize = Math.max(...items.map((it) => it.fontSize))
        const isBold = items.some(
          (it) =>
            it.fontName.toLowerCase().includes('bold') ||
            it.fontName.toLowerCase().includes('b_')
        )

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: lineText,
                bold: isBold,
                size: Math.round(maxFontSize * 2), // docx uses half-points
              }),
            ],
            spacing: { after: 120 },
          })
        )
      }

      docSections.push({
        properties: {
          page: {
            size: {
              width: Math.round(viewport.width * 20), // 1 pt = 20 dxa
              height: Math.round(viewport.height * 20),
            },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: '' })],
      })
    }

    const wordDoc = new Document({
      sections: docSections,
    })

    return new Uint8Array(await Packer.toArrayBuffer(wordDoc))
  }

  /**
   * Convert Microsoft Word (.docx) document to PDF document
   */
  static async wordToPdf(docxData: Uint8Array): Promise<Uint8Array> {
    const zip = await JSZip.loadAsync(docxData)
    const docXml = await zip.file('word/document.xml')?.async('string')
    if (!docXml) {
      throw new Error('File tidak valid: word/document.xml tidak ditemukan dalam arsip Word.')
    }

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Standard A4 portrait (595 x 842 pt)
    const pageWidth = 595
    const pageHeight = 842
    let page = pdfDoc.addPage([pageWidth, pageHeight])
    const marginX = 54
    let currentY = pageHeight - 54
    const maxWidth = pageWidth - marginX * 2

    // Parse paragraphs and tables from document.xml
    const pRegex = /<w:p[\s>].*?<\/w:p>/gs
    let pMatch: RegExpExecArray | null

    while ((pMatch = pRegex.exec(docXml)) !== null) {
      const pXml = pMatch[0]
      const rRegex = /<w:r[\s>].*?<\/w:r>/gs
      let rMatch: RegExpExecArray | null
      let fullParaText = ''
      let isBold = false

      while ((rMatch = rRegex.exec(pXml)) !== null) {
        const rXml = rMatch[0]
        if (rXml.includes('<w:b/>') || rXml.includes('<w:b ')) isBold = true
        const tRegex = /<w:t[^>]*>(.*?)<\/w:t>/gs
        let tMatch: RegExpExecArray | null
        while ((tMatch = tRegex.exec(rXml)) !== null) {
          const text = tMatch[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
          fullParaText += text
        }
      }

      fullParaText = fullParaText.trim()
      if (!fullParaText) continue

      const chosenFont = isBold ? boldFont : font
      const fontSize = isBold ? 11 : 10
      const lineHeight = fontSize * 1.4

      // Word wrapping
      const words = fullParaText.split(/\s+/)
      let currentLine = ''

      for (const w of words) {
        const testLine = currentLine ? `${currentLine} ${w}` : w
        const width = chosenFont.widthOfTextAtSize(testLine, fontSize)
        if (width > maxWidth && currentLine) {
          page.drawText(currentLine, {
            x: marginX,
            y: currentY,
            size: fontSize,
            font: chosenFont,
            color: rgb(0.12, 0.14, 0.18),
          })
          currentY -= lineHeight
          currentLine = w

          if (currentY < 50) {
            page = pdfDoc.addPage([pageWidth, pageHeight])
            currentY = pageHeight - 54
          }
        } else {
          currentLine = testLine
        }
      }

      if (currentLine) {
        page.drawText(currentLine, {
          x: marginX,
          y: currentY,
          size: fontSize,
          font: chosenFont,
          color: rgb(0.12, 0.14, 0.18),
        })
        currentY -= lineHeight + 5

        if (currentY < 50) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          currentY = pageHeight - 54
        }
      }
    }

    return pdfDoc.save()
  }

  /**
   * Convert Excel (.xlsx, .xls, .csv) document to styled PDF tables
   */
  static async excelToPdf(xlsxData: Uint8Array): Promise<Uint8Array> {
    const workbook = XLSX.read(xlsxData, { type: 'array' })
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // A4 Landscape for tabular presentation (842 x 595 pt)
    const pageWidth = 842
    const pageHeight = 595
    const marginX = 40

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
      if (!rows || rows.length === 0) continue

      let page = pdfDoc.addPage([pageWidth, pageHeight])
      let currentY = pageHeight - 45

      // Sheet Title Header Banner
      page.drawRectangle({
        x: marginX,
        y: currentY - 24,
        width: pageWidth - marginX * 2,
        height: 28,
        color: rgb(0.1, 0.13, 0.22),
      })

      page.drawText(`Sheet: ${sheetName}`, {
        x: marginX + 12,
        y: currentY - 16,
        size: 13,
        font: boldFont,
        color: rgb(1, 1, 1),
      })
      currentY -= 36

      // Find max columns
      let maxCols = 0
      for (const r of rows) {
        if (Array.isArray(r) && r.length > maxCols) maxCols = r.length
      }
      if (maxCols === 0) continue

      // Max columns clamped between 1 and 20 for clean rendering
      const renderedCols = Math.min(maxCols, 20)
      const tableWidth = pageWidth - marginX * 2
      const colWidth = tableWidth / renderedCols
      const rowHeight = 22

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx] || []
        const isHeader = rIdx === 0

        // Row background
        if (isHeader) {
          page.drawRectangle({
            x: marginX,
            y: currentY - rowHeight,
            width: tableWidth,
            height: rowHeight,
            color: rgb(0.2, 0.24, 0.35),
          })
        } else if (rIdx % 2 === 1) {
          page.drawRectangle({
            x: marginX,
            y: currentY - rowHeight,
            width: tableWidth,
            height: rowHeight,
            color: rgb(0.96, 0.97, 0.99),
          })
        }

        // Draw cell borders and text
        for (let cIdx = 0; cIdx < renderedCols; cIdx++) {
          const cellX = marginX + cIdx * colWidth
          const rawVal = row[cIdx]
          const val = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : ''

          // Cell border
          page.drawRectangle({
            x: cellX,
            y: currentY - rowHeight,
            width: colWidth,
            height: rowHeight,
            borderColor: rgb(0.82, 0.85, 0.9),
            borderWidth: 0.5,
          })

          if (val) {
            const textFont = isHeader ? boldFont : font
            const textColor = isHeader ? rgb(1, 1, 1) : rgb(0.12, 0.15, 0.2)
            const fontSize = isHeader ? 9.5 : 8.5
            const maxChars = Math.max(4, Math.floor(colWidth / (fontSize * 0.52)))
            const displayVal = val.length > maxChars ? val.slice(0, maxChars - 2) + '..' : val

            page.drawText(displayVal, {
              x: cellX + 6,
              y: currentY - rowHeight + 6,
              size: fontSize,
              font: textFont,
              color: textColor,
            })
          }
        }

        currentY -= rowHeight

        // Check if page break is needed
        if (currentY < 45 && rIdx < rows.length - 1) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          currentY = pageHeight - 45
        }
      }
    }

    return pdfDoc.save()
  }

  /**
   * Convert Excel (.xlsx, .xls) sheets into rendered images (PNG or JPG)
   */
  static async excelToImages(
    xlsxData: Uint8Array,
    format: 'png' | 'jpg' = 'png'
  ): Promise<SheetImageResult[]> {
    const workbook = XLSX.read(xlsxData, { type: 'array' })
    const results: SheetImageResult[] = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
      if (!rows || rows.length === 0) continue

      let maxCols = 0
      for (const r of rows) {
        if (Array.isArray(r) && r.length > maxCols) maxCols = r.length
      }
      if (maxCols === 0) continue

      const renderedCols = Math.min(maxCols, 25)
      const colWidth = 140
      const rowHeight = 32
      const margin = 30
      const headerBannerHeight = 50

      const canvasWidth = margin * 2 + renderedCols * colWidth
      const canvasHeight = margin * 2 + headerBannerHeight + rows.length * rowHeight

      // Render on canvas with 2x scale for crisp retina resolution
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth * scale
      canvas.height = canvasHeight * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      ctx.scale(scale, scale)

      // Background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Header Banner
      ctx.fillStyle = '#1e293b'
      ctx.fillRect(margin, margin, renderedCols * colWidth, headerBannerHeight)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 16px Inter, system-ui, -apple-system, sans-serif'
      ctx.fillText(`Sheet: ${sheetName}`, margin + 16, margin + 31)

      let curY = margin + headerBannerHeight

      // Draw Rows
      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx] || []
        const isHeader = rIdx === 0

        // Row background
        if (isHeader) {
          ctx.fillStyle = '#334155'
          ctx.fillRect(margin, curY, renderedCols * colWidth, rowHeight)
        } else if (rIdx % 2 === 1) {
          ctx.fillStyle = '#f8fafc'
          ctx.fillRect(margin, curY, renderedCols * colWidth, rowHeight)
        }

        // Draw cells
        for (let cIdx = 0; cIdx < renderedCols; cIdx++) {
          const cellX = margin + cIdx * colWidth
          const rawVal = row[cIdx]
          const val = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : ''

          // Cell border
          ctx.strokeStyle = '#e2e8f0'
          ctx.lineWidth = 1
          ctx.strokeRect(cellX, curY, colWidth, rowHeight)

          if (val) {
            ctx.fillStyle = isHeader ? '#ffffff' : '#1e293b'
            ctx.font = isHeader
              ? 'bold 12px Inter, system-ui, sans-serif'
              : '12px Inter, system-ui, sans-serif'
            
            // Clip text to cell
            ctx.save()
            ctx.beginPath()
            ctx.rect(cellX + 4, curY + 2, colWidth - 8, rowHeight - 4)
            ctx.clip()
            ctx.fillText(val, cellX + 8, curY + 20)
            ctx.restore()
          }
        }

        curY += rowHeight
      }

      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
      const dataUrl = canvas.toDataURL(mimeType, 0.95)
      results.push({
        sheetName,
        dataUrl,
        filename: `${sheetName}.${format}`,
      })
    }

    return results
  }

  /**
   * Convert Excel sheets to images and package into a ZIP archive
   */
  static async excelToImagesZip(
    xlsxData: Uint8Array,
    format: 'png' | 'jpg' = 'png'
  ): Promise<Uint8Array> {
    const images = await this.excelToImages(xlsxData, format)
    const zip = new JSZip()

    for (const img of images) {
      const base64Data = img.dataUrl.split(',')[1]
      zip.file(img.filename, base64Data, { base64: true })
    }

    return zip.generateAsync({ type: 'uint8array' })
  }

  /**
   * Convert PDF Document to Microsoft Excel (.xlsx) spreadsheet
   */
  static async pdfToExcel(pdfData: Uint8Array): Promise<Uint8Array> {
    const pdfDoc = await PdfLoader.loadDocument(pdfData)
    const wb = XLSX.utils.book_new()

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p)
      const textContent = await page.getTextContent()

      // Cluster items by Y (baseline within 5 points)
      const rowMap = new Map<number, Array<{ x: number; width: number; text: string }>>()
      for (const rawItem of textContent.items) {
        const item = rawItem as any
        if (!item.str || !item.str.trim()) continue
        const y = Math.round(item.transform[5] / 5) * 5
        const list = rowMap.get(y) || []
        list.push({
          x: item.transform[4],
          width: item.width || 0,
          text: item.str.trim(),
        })
        rowMap.set(y, list)
      }

      // Sort rows descending Y (top of page to bottom)
      const sortedYs = Array.from(rowMap.keys()).sort((a, b) => b - a)
      const sheetRows: string[][] = []

      for (const y of sortedYs) {
        const items = rowMap.get(y) || []
        items.sort((a, b) => a.x - b.x)

        // Cluster items by horizontal gap (> 18 points is a new cell/column)
        const rowCells: string[] = []
        let currentCellText = ''
        let prevEndX = -1

        for (const item of items) {
          if (prevEndX >= 0 && item.x - prevEndX > 18) {
            rowCells.push(currentCellText.trim())
            currentCellText = item.text
          } else {
            currentCellText = currentCellText ? `${currentCellText} ${item.text}` : item.text
          }
          prevEndX = item.x + item.width
        }
        if (currentCellText) {
          rowCells.push(currentCellText.trim())
        }

        if (rowCells.length > 0) {
          sheetRows.push(rowCells)
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetRows.length > 0 ? sheetRows : [['(Halaman Kosong)']])
      XLSX.utils.book_append_sheet(wb, ws, `Page ${p}`)
    }

    const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    return new Uint8Array(xlsxBytes)
  }
}
