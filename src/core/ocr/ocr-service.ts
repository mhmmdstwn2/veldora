import { createWorker, Worker } from 'tesseract.js'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { PdfLoader } from '@/core/pdf/pdf-loader'
import { OcrProgress, PdfTextElement } from '@/types'

export interface OcrResultBlock {
  text: string
  confidence: number
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

export class OcrService {
  private static worker: Worker | null = null
  private static currentLang = ''

  /**
   * Initializes or reuses a Tesseract OCR Worker
   */
  private static async getWorker(
    languages: ('ind' | 'eng')[],
    onProgress?: (progress: OcrProgress) => void,
    currentPage = 1,
    totalPages = 1
  ): Promise<Worker> {
    const langKey = languages.join('+')

    if (!this.worker || this.currentLang !== langKey) {
      if (this.worker) {
        await this.worker.terminate()
        this.worker = null
      }

      const resolveLocalUrl = (relativePath: string) =>
        typeof window !== 'undefined'
          ? new URL(relativePath, window.location.href).href
          : relativePath

      this.worker = await createWorker(langKey, 1, {
        workerPath: resolveLocalUrl('./tesseract/worker.min.js'),
        corePath: resolveLocalUrl('./tesseract/'),
        langPath: resolveLocalUrl('./tesseract/lang'),
        workerBlobURL: false,
        logger: (m) => {
          if (onProgress && m.status) {
            const labelMap: Record<string, string> = {
              'loading tesseract core': 'Memuat engine OCR lokal...',
              'loading language traineddata': 'Memuat kamus bahasa offline...',
              'initializing api': 'Menyiapkan pengenal teks...',
              'recognizing text': `Mengenali teks (${Math.round((m.progress || 0) * 100)}%)...`,
            }
            onProgress({
              status: labelMap[m.status] || `Memproses OCR (${m.status})...`,
              progress: m.status === 'recognizing text' ? m.progress : Math.min(0.2, (m.progress || 0) * 0.2),
              page: currentPage,
              totalPages,
            })
          }
        },
      })
      this.currentLang = langKey
    }

    return this.worker
  }

  /**
   * Performs OCR on a specific page of a PDF document
   */
  static async recognizePage(
    pdfDoc: any,
    pageNumber: number,
    languages: ('ind' | 'eng')[] = ['ind', 'eng'],
    onProgress?: (progress: OcrProgress) => void,
    totalPages = 1
  ): Promise<{
    text: string
    blocks: OcrResultBlock[]
    words?: OcrResultBlock[]
    imageWidth: number
    imageHeight: number
  }> {
    const worker = await this.getWorker(languages, onProgress, pageNumber, totalPages)

    // Render page to an offscreen high-res canvas (2.0 scale for crisp OCR accuracy)
    const page = await pdfDoc.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2.0 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise

    const dataUrl = canvas.toDataURL('image/png')

    if (onProgress) {
      onProgress({
        status: `Memproses OCR pada halaman ${pageNumber}...`,
        progress: 0.1,
        page: pageNumber,
        totalPages,
      })
    }

    const { data } = await worker.recognize(dataUrl)

    const lines: OcrResultBlock[] = []
    const words: OcrResultBlock[] = []

    if (data.blocks && data.blocks.length > 0) {
      for (const block of data.blocks) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            const trimmedLine = line.text?.trim()
            if (trimmedLine) {
              lines.push({
                text: trimmedLine,
                confidence: line.confidence,
                bbox: {
                  x0: line.bbox.x0,
                  y0: line.bbox.y0,
                  x1: line.bbox.x1,
                  y1: line.bbox.y1,
                },
              })
            }

            for (const w of line.words || []) {
              if (w.text?.trim()) {
                words.push({
                  text: w.text.trim(),
                  confidence: w.confidence,
                  bbox: {
                    x0: w.bbox.x0,
                    y0: w.bbox.y0,
                    x1: w.bbox.x1,
                    y1: w.bbox.y1,
                  },
                })
              }
            }
          }
        }
      }
    } else if ((data as any).words && (data as any).words.length > 0) {
      for (const w of (data as any).words) {
        if (w.text?.trim()) {
          const item = {
            text: w.text.trim(),
            confidence: w.confidence,
            bbox: {
              x0: w.bbox.x0,
              y0: w.bbox.y0,
              x1: w.bbox.x1,
              y1: w.bbox.y1,
            },
          }
          words.push(item)
          lines.push(item)
        }
      }
    }

    return {
      text: data.text,
      blocks: lines.length > 0 ? lines : words,
      words,
      imageWidth: viewport.width,
      imageHeight: viewport.height,
    }
  }

  /**
   * Mode 1: Searchable PDF
   * Injects an invisible vector text layer over scanned pages using pdf-lib
   */
  static async createSearchablePdf(
    sourcePdfBytes: Uint8Array,
    languages: ('ind' | 'eng')[] = ['ind', 'eng'],
    pageNumbers?: number[],
    onProgress?: (progress: OcrProgress) => void
  ): Promise<Uint8Array> {
    const pdfJsDoc = await PdfLoader.loadDocument(sourcePdfBytes)
    const pdfLibDoc = await PDFDocument.load(sourcePdfBytes)
    const font = await pdfLibDoc.embedFont(StandardFonts.Helvetica)

    const targetPages = pageNumbers ?? Array.from({ length: pdfJsDoc.numPages }, (_, i) => i + 1)
    const total = targetPages.length

    for (let idx = 0; idx < total; idx++) {
      const pageNum = targetPages[idx]
      const { words, blocks, imageWidth, imageHeight } = await this.recognizePage(
        pdfJsDoc,
        pageNum,
        languages,
        onProgress,
        total
      )

      const pdfLibPage = pdfLibDoc.getPage(pageNum - 1)
      const { width: pageWidth, height: pageHeight } = pdfLibPage.getSize()

      // Scale ratio between OCR image canvas and PDF points
      const scaleX = pageWidth / imageWidth
      const scaleY = pageHeight / imageHeight

      const targetBlocks = (words && words.length > 0) ? words : blocks

      for (const b of targetBlocks) {
        const x = b.bbox.x0 * scaleX
        // In PDF coordinate space, Y = 0 is at the bottom
        const y = pageHeight - b.bbox.y1 * scaleY
        const wordHeight = (b.bbox.y1 - b.bbox.y0) * scaleY

        // Draw invisible searchable text (opacity 0)
        try {
          pdfLibPage.drawText(b.text, {
            x,
            y,
            size: Math.max(6, Math.min(36, wordHeight)),
            font,
            color: rgb(0, 0, 0),
            opacity: 0.001, // Invisible overlay for Acrobat text selection & search
          })
        } catch {
          // ignore font encoding errors on odd symbols
        }
      }
    }

    return pdfLibDoc.save()
  }

  /**
   * Mode 2: Editable OCR
   * Converts recognized blocks into PdfTextElements that the user can edit directly in Veldora like Canva
   */
  static convertBlocksToEditableText(
    blocks: OcrResultBlock[],
    imageWidth: number,
    imageHeight: number,
    pageNumber: number
  ): PdfTextElement[] {
    const results: PdfTextElement[] = []

    for (const b of blocks) {
      const text = b.text.trim()
      if (!text) continue

      const xPercent = (b.bbox.x0 / imageWidth) * 100
      const yPercent = (b.bbox.y0 / imageHeight) * 100
      const widthPercent = ((b.bbox.x1 - b.bbox.x0) / imageWidth) * 100
      const heightPercent = ((b.bbox.y1 - b.bbox.y0) / imageHeight) * 100

      // Approximate font size matching line height accurately (accounting for 2x render scale)
      const fontHeightPx = b.bbox.y1 - b.bbox.y0
      const fontSize = Math.max(9, Math.round((fontHeightPx / 2.0) * 0.75))

      results.push({
        id: `ocr_txt_${pageNumber}_${results.length}_${Math.random().toString(36).substring(2, 6)}`,
        pageNumber,
        text,
        originalText: text,
        x: Math.max(0, Math.min(99, Math.round(xPercent * 100) / 100)),
        y: Math.max(0, Math.min(99, Math.round(yPercent * 100) / 100)),
        width: Math.min(100, Math.round(widthPercent * 100) / 100),
        height: Math.min(100, Math.round(heightPercent * 100) / 100),
        fontSize,
        fontFamily: 'Helvetica',
        color: '#0f172a',
        isModified: false,
        isDeleted: false,
      })
    }

    return results
  }

  /**
   * Terminate active worker on cleanup
   */
  static async terminate() {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
  }
}
