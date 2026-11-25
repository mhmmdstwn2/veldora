import { PDFDocument } from 'pdf-lib'
import { PdfLoader } from './pdf-loader'

export interface CompressResult {
  compressedData: Uint8Array
  originalSize: number
  newSize: number
  savingsPercent: number
}

export class PdfCompressor {
  static async compress(
    data: Uint8Array,
    level: 'low' | 'medium' | 'high'
  ): Promise<CompressResult> {
    const originalSize = data.byteLength

    // Compression quality settings
    const qualityMap = {
      low: { scale: 1.2, quality: 0.8 },
      medium: { scale: 1.0, quality: 0.6 },
      high: { scale: 0.8, quality: 0.4 },
    }

    const { scale, quality } = qualityMap[level]

    try {
      const pdfJsDoc = await PdfLoader.loadDocument(data)
      const newPdfDoc = await PDFDocument.create()

      for (let i = 1; i <= pdfJsDoc.numPages; i++) {
        const page = await pdfJsDoc.getPage(i)
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d')
        if (!ctx) continue

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise

        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const embeddedImage = await newPdfDoc.embedJpg(dataUrl)

        // Add page matching original aspect ratio
        const origViewport = page.getViewport({ scale: 1.0 })
        const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height])
        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: origViewport.width,
          height: origViewport.height,
        })
      }

      const compressedData = await newPdfDoc.save()
      const newSize = compressedData.byteLength
      const savingsPercent = Math.max(
        0,
        Math.round(((originalSize - newSize) / originalSize) * 100)
      )

      return {
        compressedData,
        originalSize,
        newSize,
        savingsPercent,
      }
    } catch (e) {
      console.warn('Canvas-based compression fallback to structure cleanup:', e)
      // Fallback: reload and save with pdf-lib cleanup
      const doc = await PDFDocument.load(data)
      const compressedData = await doc.save()
      const newSize = compressedData.byteLength
      const savingsPercent = Math.max(
        0,
        Math.round(((originalSize - newSize) / originalSize) * 100)
      )
      return {
        compressedData,
        originalSize,
        newSize,
        savingsPercent,
      }
    }
  }
}

