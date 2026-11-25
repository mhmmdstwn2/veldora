import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker using purely local bundled assets (100% offline)
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      './pdf.worker.min.mjs',
      window.location.href
    ).toString()
  }
}

export interface RenderPageOptions {
  scale?: number
  rotation?: number
}

export class PdfLoader {
  private static activeRenderTasks = new WeakMap<HTMLCanvasElement, any>()

  static async loadDocument(data: Uint8Array) {
    // CRITICAL: Clone the buffer using data.slice() so the PDF.js Web Worker never detaches the original ArrayBuffer!
    const bufferClone = new Uint8Array(data.slice())
    const resolveAssetDir = (dir: string) =>
      typeof window !== 'undefined' ? new URL(dir, window.location.href).href : dir

    const loadingTask = pdfjsLib.getDocument({
      data: bufferClone,
      cMapUrl: resolveAssetDir('./cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: resolveAssetDir('./standard_fonts/'),
    })
    return loadingTask.promise
  }

  static async renderPageToCanvas(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    canvas: HTMLCanvasElement,
    options: RenderPageOptions = {}
  ) {
    // 1. If there's an ongoing render task on this canvas, cancel it cleanly first!
    const existingTask = this.activeRenderTasks.get(canvas)
    if (existingTask) {
      try {
        existingTask.cancel()
      } catch {
        // ignore
      }
      this.activeRenderTasks.delete(canvas)
    }

    const page = await pdfDoc.getPage(pageNumber)
    const scale = options.scale ?? 1.5
    const rotation = (page.rotate + (options.rotation ?? 0)) % 360

    const viewport = page.getViewport({ scale, rotation })
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context not available')

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const renderContext = {
      canvasContext: ctx,
      viewport,
    }

    const renderTask = page.render(renderContext)
    this.activeRenderTasks.set(canvas, renderTask)

    try {
      await renderTask.promise
    } catch (err: any) {
      // RenderingCancelledException is expected when fast-switching pages or zooming
      if (err?.name === 'RenderingCancelledException') {
        return { width: viewport.width, height: viewport.height }
      }
      throw err
    } finally {
      if (this.activeRenderTasks.get(canvas) === renderTask) {
        this.activeRenderTasks.delete(canvas)
      }
    }

    return { width: viewport.width, height: viewport.height }
  }

  static async generateThumbnail(
    pdfDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    maxWidth = 160
  ): Promise<string> {
    const page = await pdfDoc.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.0 })
    const scale = maxWidth / viewport.width
    const scaledViewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = scaledViewport.width
    canvas.height = scaledViewport.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    await page.render({
      canvasContext: ctx,
      viewport: scaledViewport,
    }).promise

    return canvas.toDataURL('image/jpeg', 0.8)
  }
}
