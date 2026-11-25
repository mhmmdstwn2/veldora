import { create } from 'zustand'
import {
  DocumentInfo,
  PageThumbnail,
  ToolType,
  FitMode,
  AnnotationItem,
  RecentDocument,
  DetectedSignatureSpot,
  PdfTextElement,
  PdfImageElement,
  PdfOutlineItem,
  SelectedObject,
  WatermarkOptions,
  PageNumberOptions,
  CropOptions,
  OcrProgress,
} from '@/types'
import { PdfLoader } from '@/core/pdf/pdf-loader'
import { PdfContentExtractor } from '@/core/pdf/pdf-content-extractor'
import { SignatureDetector } from '@/core/pdf/signature-detector'
import { PdfEditor } from '@/core/pdf/pdf-editor'
import { getFileAdapter } from '@/adapters'

interface PdfState {
  originalDocBytes: Uint8Array | null
  currentDoc: DocumentInfo | null
  pdfJsDoc: any | null
  pages: PageThumbnail[]
  currentPage: number
  zoom: number
  fitMode: FitMode
  rotation: number
  activeTool: ToolType
  activeModal: string | null
  annotations: AnnotationItem[]
  history: {
    annotations: AnnotationItem[]
    originalTexts: PdfTextElement[]
    originalImages: PdfImageElement[]
  }[]
  historyIndex: number
  isLoading: boolean
  errorMessage: string | null
  recentFiles: RecentDocument[]
  color: string
  fontSize: number

  // Original PDF content elements (True PDF Editing)
  originalTexts: PdfTextElement[]
  originalImages: PdfImageElement[]
  outline: PdfOutlineItem[]
  selectedObject: SelectedObject | null

  // UI Panels state
  isPropertiesOpen: boolean
  leftSidebarTab: 'pages' | 'outline' | 'layers'

  // Document enhancements
  watermarkOptions: WatermarkOptions | null
  pageNumberOptions: PageNumberOptions | null

  // Mode: Canva-style Content Editor vs EmbedPDF Review/Form
  editorMode: 'content' | 'review'
  setEditorMode: (mode: 'content' | 'review') => void

  // Signature Detection
  detectedSignatureSpots: DetectedSignatureSpot[]
  activeSignatureSpot: DetectedSignatureSpot | null
  savedSignature: string | null

  // OCR state
  isOcrRunning: boolean
  ocrProgress: OcrProgress | null

  // Actions
  loadDocumentFromData: (data: Uint8Array, name: string, path?: string) => Promise<void>
  openFileWithPicker: () => Promise<void>
  closeDocument: () => void
  setCurrentPage: (page: number) => void
  setZoom: (zoom: number) => void
  setFitMode: (mode: FitMode) => void
  setRotation: (deg: number) => void
  rotateCurrentPage: (deg: number) => void
  setActiveTool: (tool: ToolType) => void
  setActiveModal: (modal: string | null) => void
  setColor: (color: string) => void
  setFontSize: (size: number) => void

  // Original Content Extraction & Actions
  extractPageContent: (pageNumber: number) => Promise<void>
  extractDocumentOutline: () => Promise<void>
  updateOriginalText: (id: string, updates: Partial<PdfTextElement>) => void
  commitTextEdit: (id: string, updates: Partial<PdfTextElement>) => Promise<void>
  deleteOriginalText: (id: string) => Promise<void>
  updateOriginalImage: (id: string, updates: Partial<PdfImageElement>) => void
  deleteOriginalImage: (id: string) => void
  replaceOriginalImage: (id: string, dataUrl: string) => void

  // Object Selection & Panels
  setSelectedObject: (obj: SelectedObject | null) => void
  setPropertiesOpen: (open: boolean) => void
  setLeftSidebarTab: (tab: 'pages' | 'outline' | 'layers') => void

  // Page Operations
  insertBlankPage: (afterPageNumber?: number) => Promise<void>
  deletePageFromDoc: (pageNumber: number) => Promise<void>
  duplicateCurrentPage: () => Promise<void>
  cropCurrentPage: (crop: CropOptions) => Promise<void>
  setWatermark: (options: WatermarkOptions | null) => void
  setPageNumbers: (options: PageNumberOptions | null) => void

  // Annotations & History
  addAnnotation: (item: Omit<AnnotationItem, 'id' | 'createdAt'>) => string
  updateAnnotation: (id: string, updates: Partial<AnnotationItem>) => void
  removeAnnotation: (id: string) => void
  clearAnnotations: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Signature Spot Actions
  scanSignatureSpots: (pageNumber?: number) => Promise<void>
  setActiveSignatureSpot: (spot: DetectedSignatureSpot | null) => void
  setSavedSignature: (dataUrl: string) => void

  // OCR Actions
  setOcrRunning: (running: boolean) => void
  setOcrProgress: (progress: OcrProgress | null) => void
  applyOcrEditableText: (elements: PdfTextElement[]) => void

  // Recent files
  loadRecentFiles: () => Promise<void>
}

export const usePdfStore = create<PdfState>((set, get) => ({
  originalDocBytes: null,
  currentDoc: null,
  pdfJsDoc: null,
  pages: [],
  currentPage: 1,
  zoom: 1.0,
  fitMode: 'custom',
  rotation: 0,
  activeTool: 'select',
  activeModal: null,
  annotations: [],
  history: [{ annotations: [], originalTexts: [], originalImages: [] }],
  historyIndex: 0,
  isLoading: false,
  errorMessage: null,
  recentFiles: [],
  color: '#8b5cf6',
  fontSize: 14,

  originalTexts: [],
  originalImages: [],
  outline: [],
  selectedObject: null,
  isPropertiesOpen: false,
  leftSidebarTab: 'pages',
  watermarkOptions: null,
  pageNumberOptions: null,
  editorMode: 'content',
  setEditorMode: (mode: 'content' | 'review') => set({ editorMode: mode }),

  detectedSignatureSpots: [],
  activeSignatureSpot: null,
  savedSignature:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('veldora_saved_signature')
      : null,

  isOcrRunning: false,
  ocrProgress: null,

  loadDocumentFromData: async (data: Uint8Array, name: string, path?: string) => {
    set({ isLoading: true, errorMessage: null })
    try {
      const originalDocBytes = new Uint8Array(data.slice())
      const pdfJsDoc = await PdfLoader.loadDocument(originalDocBytes.slice())
      const pageCount = pdfJsDoc.numPages

      const pages: PageThumbnail[] = []
      for (let i = 1; i <= pageCount; i++) {
        pages.push({
          pageNumber: i,
          width: 595,
          height: 842,
          rotation: 0,
        })
      }

      const docInfo: DocumentInfo = {
        name,
        path,
        size: data.byteLength,
        pageCount,
        data: originalDocBytes.slice(),
      }

      set({
        originalDocBytes,
        currentDoc: docInfo,
        pdfJsDoc,
        pages,
        currentPage: 1,
        zoom: 1.0,
        annotations: [],
        originalTexts: [],
        originalImages: [],
        outline: [],
        selectedObject: null,
        history: [{ annotations: [], originalTexts: [], originalImages: [] }],
        historyIndex: 0,
        isLoading: false,
        detectedSignatureSpots: [],
        activeSignatureSpot: null,
      })

      // Add to recent files
      const adapter = getFileAdapter()
      await adapter.addRecentFile({
        name,
        path,
        size: data.byteLength,
        pageCount,
      })
      get().loadRecentFiles()

      // Extract outline and original content for page 1
      get().extractDocumentOutline()
      get().extractPageContent(1)
      get().scanSignatureSpots(1)

      // Generate thumbnails asynchronously in background
      setTimeout(async () => {
        const updatedPages = [...pages]
        for (let i = 1; i <= Math.min(pageCount, 25); i++) {
          try {
            const thumb = await PdfLoader.generateThumbnail(pdfJsDoc, i, 160)
            updatedPages[i - 1] = {
              ...updatedPages[i - 1],
              dataUrl: thumb,
            }
          } catch {
            // ignore
          }
        }
        set({ pages: updatedPages })
      }, 50)
    } catch (err: any) {
      console.error('Failed to open PDF:', err)
      set({
        isLoading: false,
        errorMessage: err.message || 'Failed to load PDF document.',
      })
    }
  },

  openFileWithPicker: async () => {
    const adapter = getFileAdapter()
    const doc = await adapter.openFile()
    if (doc) {
      await get().loadDocumentFromData(doc.data, doc.name, doc.path)
    }
  },

  closeDocument: () => {
    set({
      currentDoc: null,
      pdfJsDoc: null,
      pages: [],
      currentPage: 1,
      annotations: [],
      originalTexts: [],
      originalImages: [],
      outline: [],
      selectedObject: null,
      history: [{ annotations: [], originalTexts: [], originalImages: [] }],
      historyIndex: 0,
      activeModal: null,
      detectedSignatureSpots: [],
      activeSignatureSpot: null,
    })
  },

  setCurrentPage: (page: number) => {
    const total = get().pages.length
    const bounded = Math.max(1, Math.min(total, page))
    set({ currentPage: bounded, selectedObject: null })
    get().extractPageContent(bounded)
    get().scanSignatureSpots(bounded)
  },

  setZoom: (zoom: number) => {
    const bounded = Math.max(0.25, Math.min(5.0, zoom))
    set({ zoom: bounded, fitMode: 'custom' })
  },

  setFitMode: (mode: FitMode) => {
    set({ fitMode: mode })
  },

  setRotation: (deg: number) => {
    set({ rotation: deg % 360 })
  },

  rotateCurrentPage: (deg: number) => {
    const { currentPage, pages } = get()
    const updated = pages.map((p) =>
      p.pageNumber === currentPage
        ? { ...p, rotation: (p.rotation + deg) % 360 }
        : p
    )
    set({ pages: updated })
  },

  setActiveTool: (tool: ToolType) => {
    set({ activeTool: tool })
    if (tool === 'sign') {
      get().scanSignatureSpots(get().currentPage)
    }
  },

  setActiveModal: (modal: string | null) => {
    set({ activeModal: modal })
  },

  setColor: (color: string) => {
    set({ color })
  },

  setFontSize: (fontSize: number) => {
    set({ fontSize })
  },

  extractPageContent: async (pageNumber: number) => {
    const { pdfJsDoc } = get()
    if (!pdfJsDoc) return
    try {
      const [texts, images] = await Promise.all([
        PdfContentExtractor.extractPageTextElements(pdfJsDoc, pageNumber),
        PdfContentExtractor.extractPageImages(pdfJsDoc, pageNumber),
      ])

      // Preserve existing edited, modified, or deleted elements on this page
      const existingPageTexts = get().originalTexts.filter((t) => t.pageNumber === pageNumber)
      const existingPageImages = get().originalImages.filter((img) => img.pageNumber === pageNumber)

      const mergedTexts = texts.map((newT) => {
        const existing = existingPageTexts.find(
          (et) =>
            et.id === newT.id ||
            (et.blockIndex !== undefined && et.blockIndex === newT.blockIndex) ||
            (et.blockIndices &&
              newT.blockIndices &&
              et.blockIndices.some((idx) => newT.blockIndices?.includes(idx)))
        )
        if (existing && (existing.isModified || existing.isDeleted)) {
          return {
            ...newT,
            ...existing,
            origX: newT.origX ?? existing.origX,
            origY: newT.origY ?? existing.origY,
            origWidth: Math.max(existing.origWidth ?? 0, newT.origWidth ?? 0),
            origHeight: Math.max(existing.origHeight ?? 0, newT.origHeight ?? 0),
            pdfX: newT.pdfX ?? existing.pdfX,
            pdfBaselineY: newT.pdfBaselineY ?? existing.pdfBaselineY,
            pdfWidth: Math.max(existing.pdfWidth ?? 0, newT.pdfWidth ?? 0),
            pdfHeight: newT.pdfHeight ?? existing.pdfHeight,
            blockIndices: newT.blockIndices || existing.blockIndices,
          }
        }
        return newT
      })
      const extraTexts = existingPageTexts.filter(
        (et) =>
          (et.isModified || et.isDeleted) &&
          !texts.some(
            (newT) =>
              newT.id === et.id ||
              (et.blockIndices &&
                newT.blockIndices &&
                et.blockIndices.some((idx) => newT.blockIndices?.includes(idx)))
          )
      )

      const mergedImages = images.map((newImg) => {
        const existing = existingPageImages.find(
          (ei) => ei.id === newImg.id || ei.imgId === newImg.imgId
        )
        if (existing) {
          return {
            ...newImg,
            ...existing,
            dataUrl: existing.dataUrl || newImg.dataUrl,
            replacementDataUrl: existing.replacementDataUrl || newImg.replacementDataUrl,
          }
        }
        return newImg
      })
      const extraImages = existingPageImages.filter(
        (ei) =>
          (ei.isModified || ei.isDeleted || ei.replacementDataUrl) &&
          !images.some((newImg) => newImg.id === ei.id)
      )

      const otherPageTexts = get().originalTexts.filter((t) => t.pageNumber !== pageNumber)
      const otherPageImages = get().originalImages.filter((img) => img.pageNumber !== pageNumber)

      set({
        originalTexts: [...otherPageTexts, ...mergedTexts, ...extraTexts],
        originalImages: [...otherPageImages, ...mergedImages, ...extraImages],
      })
    } catch (e) {
      console.warn('Failed to extract page content:', e)
    }
  },

  extractDocumentOutline: async () => {
    const { pdfJsDoc } = get()
    if (!pdfJsDoc) return
    try {
      const outline = await PdfContentExtractor.extractDocumentOutline(pdfJsDoc)
      set({ outline })
    } catch (e) {
      console.warn('Failed to extract outline:', e)
    }
  },

  updateOriginalText: (id: string, updates: Partial<PdfTextElement>) => {
    const isActuallyModified =
      updates.isModified !== undefined
        ? updates.isModified
        : updates.text !== undefined ||
        updates.x !== undefined ||
        updates.y !== undefined ||
        updates.fontSize !== undefined ||
        updates.color !== undefined ||
        updates.isDeleted !== undefined

    const nextTexts = get().originalTexts.map((t) => {
      if (t.id !== id) return t
      const isMod = isActuallyModified ? true : (t.isModified ?? false)
      return { ...t, ...updates, isModified: isMod }
    })

    // ONLY push to history if it is an actual user modification, NOT internal metadata sampling
    if (isActuallyModified) {
      const { history, historyIndex, annotations, originalImages } = get()
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push({
        annotations,
        originalTexts: nextTexts,
        originalImages,
      })

      set({
        originalTexts: nextTexts,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      })
    } else {
      set({ originalTexts: nextTexts })
    }

    // Update selected object
    const selected = get().selectedObject
    if (selected && selected.id === id) {
      set({ selectedObject: { ...selected, data: { ...selected.data, ...updates } } })
    }
  },

  commitTextEdit: async (id: string, updates: Partial<PdfTextElement>) => {
    get().updateOriginalText(id, { ...updates, isModified: true })
  },

  deleteOriginalText: async (id: string) => {
    get().updateOriginalText(id, { isDeleted: true, isModified: true })
    set({ selectedObject: null })
  },

  updateOriginalImage: (id: string, updates: Partial<PdfImageElement>) => {
    const nextImages = get().originalImages.map((img) =>
      img.id === id ? { ...img, ...updates, isModified: updates.isModified ?? true } : img
    )

    const { history, historyIndex, annotations, originalTexts } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      annotations,
      originalTexts,
      originalImages: nextImages,
    })

    set({
      originalImages: nextImages,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    })

    const selected = get().selectedObject
    if (selected && selected.id === id) {
      set({ selectedObject: { ...selected, data: { ...selected.data, ...updates, isModified: updates.isModified ?? true } } })
    }
  },

  deleteOriginalImage: (id: string) => {
    const nextImages = get().originalImages.map((img) =>
      img.id === id ? { ...img, isDeleted: true, isModified: true } : img
    )

    const { history, historyIndex, annotations, originalTexts } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      annotations,
      originalTexts,
      originalImages: nextImages,
    })

    set({
      originalImages: nextImages,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      selectedObject: null,
    })
  },

  replaceOriginalImage: (id: string, dataUrl: string) => {
    const nextImages = get().originalImages.map((img) =>
      img.id === id ? { ...img, replacementDataUrl: dataUrl, isDeleted: false, isModified: true } : img
    )

    const { history, historyIndex, annotations, originalTexts } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      annotations,
      originalTexts,
      originalImages: nextImages,
    })

    set({
      originalImages: nextImages,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    })

    const selected = get().selectedObject
    if (selected && selected.id === id) {
      set({
        selectedObject: {
          ...selected,
          data: {
            ...selected.data,
            replacementDataUrl: dataUrl,
            isDeleted: false,
            isModified: true,
          },
        },
      })
    }
  },

  setSelectedObject: (obj: SelectedObject | null) => {
    set({
      selectedObject: obj,
      isPropertiesOpen: obj !== null, // Auto-open properties panel when an object is clicked
    })
  },

  setPropertiesOpen: (open: boolean) => {
    set({ isPropertiesOpen: open })
  },

  setLeftSidebarTab: (tab: 'pages' | 'outline' | 'layers') => {
    set({ leftSidebarTab: tab })
  },

  insertBlankPage: async (afterPageNumber?: number) => {
    const {
      currentDoc,
      originalDocBytes,
      currentPage,
      pdfJsDoc,
      annotations,
      originalTexts,
      originalImages,
      pages,
      zoom,
    } = get()
    if (!currentDoc) return

    const insertAfter = afterPageNumber ?? currentPage
    const targetPageNum = Math.max(1, insertAfter + 1)
    set({ isLoading: true, errorMessage: null })

    try {
      // Match page dimensions of adjacent page so blank page aligns seamlessly
      let pageW = 595.28
      let pageH = 841.89
      if (pdfJsDoc) {
        try {
          const refIdx = Math.max(1, Math.min(pdfJsDoc.numPages, insertAfter || 1))
          const refPage = await pdfJsDoc.getPage(refIdx)
          const vp = refPage.getViewport({ scale: 1.0 })
          pageW = vp.width
          pageH = vp.height
        } catch {
          // fallback A4
        }
      }

      const baseBytes = originalDocBytes || currentDoc.data
      const updatedBytes = await PdfEditor.insertBlankPage(baseBytes, targetPageNum, pageW, pageH)
      const nextOriginalBytes = new Uint8Array(updatedBytes.slice())
      const nextPdfJsDoc = await PdfLoader.loadDocument(nextOriginalBytes.slice())
      const pageCount = nextPdfJsDoc.numPages

      const shiftPage = (p: number) => (p >= targetPageNum ? p + 1 : p)
      const shiftedAnnotations = annotations.map((a) => ({ ...a, pageNumber: shiftPage(a.pageNumber) }))
      const shiftedTexts = originalTexts.map((t) => ({ ...t, pageNumber: shiftPage(t.pageNumber) }))
      const shiftedImages = originalImages.map((img) => ({ ...img, pageNumber: shiftPage(img.pageNumber) }))

      const nextPages: PageThumbnail[] = []
      for (let i = 1; i <= pageCount; i++) {
        if (i < targetPageNum) {
          const prev = pages.find((p) => p.pageNumber === i)
          nextPages.push(
            prev ? { ...prev, pageNumber: i } : { pageNumber: i, width: Math.round(pageW), height: Math.round(pageH), rotation: 0 }
          )
        } else if (i === targetPageNum) {
          nextPages.push({ pageNumber: i, width: Math.round(pageW), height: Math.round(pageH), rotation: 0 })
        } else {
          const prev = pages.find((p) => p.pageNumber === i - 1)
          nextPages.push(
            prev ? { ...prev, pageNumber: i } : { pageNumber: i, width: Math.round(pageW), height: Math.round(pageH), rotation: 0 }
          )
        }
      }

      const nextDocInfo: DocumentInfo = {
        ...currentDoc,
        size: nextOriginalBytes.byteLength,
        pageCount,
        data: nextOriginalBytes.slice(),
      }

      set({
        originalDocBytes: nextOriginalBytes,
        currentDoc: nextDocInfo,
        pdfJsDoc: nextPdfJsDoc,
        pages: nextPages,
        currentPage: targetPageNum,
        zoom,
        annotations: shiftedAnnotations,
        originalTexts: shiftedTexts,
        originalImages: shiftedImages,
        selectedObject: null,
        activeTool: 'select',
        history: [{ annotations: shiftedAnnotations, originalTexts: shiftedTexts, originalImages: shiftedImages }],
        historyIndex: 0,
        isLoading: false,
        detectedSignatureSpots: [],
        activeSignatureSpot: null,
      })

      get().extractPageContent(targetPageNum)
      get().scanSignatureSpots(targetPageNum)

      setTimeout(async () => {
        try {
          const thumb = await PdfLoader.generateThumbnail(nextPdfJsDoc, targetPageNum, 160)
          set((state) => ({
            pages: state.pages.map((p) =>
              p.pageNumber === targetPageNum ? { ...p, dataUrl: thumb } : p
            ),
          }))
        } catch {
          // ignore
        }
      }, 50)
    } catch (err: any) {
      console.error('Failed to insert blank page:', err)
      set({
        isLoading: false,
        errorMessage: err?.message || 'Failed to insert blank page.',
      })
    }
  },

  deletePageFromDoc: async (pageNumber: number) => {
    const {
      currentDoc,
      originalDocBytes,
      pages,
      annotations,
      originalTexts,
      originalImages,
      zoom,
    } = get()
    if (!currentDoc || pages.length <= 1) return

    set({ isLoading: true, errorMessage: null })
    try {
      const baseBytes = originalDocBytes || currentDoc.data
      const updatedBytes = await PdfEditor.deletePages(baseBytes, [pageNumber])
      const nextOriginalBytes = new Uint8Array(updatedBytes.slice())
      const nextPdfJsDoc = await PdfLoader.loadDocument(nextOriginalBytes.slice())
      const pageCount = nextPdfJsDoc.numPages

      const filterAndShift = <T extends { pageNumber: number }>(items: T[]) =>
        items
          .filter((item) => item.pageNumber !== pageNumber)
          .map((item) => ({
            ...item,
            pageNumber: item.pageNumber > pageNumber ? item.pageNumber - 1 : item.pageNumber,
          }))

      const shiftedAnnotations = filterAndShift(annotations)
      const shiftedTexts = filterAndShift(originalTexts)
      const shiftedImages = filterAndShift(originalImages)
      const nextPages = pages
        .filter((p) => p.pageNumber !== pageNumber)
        .map((p, idx) => ({ ...p, pageNumber: idx + 1 }))

      const nextPage = Math.max(1, Math.min(pageNumber, pageCount))
      const nextDocInfo: DocumentInfo = {
        ...currentDoc,
        size: nextOriginalBytes.byteLength,
        pageCount,
        data: nextOriginalBytes.slice(),
      }

      set({
        originalDocBytes: nextOriginalBytes,
        currentDoc: nextDocInfo,
        pdfJsDoc: nextPdfJsDoc,
        pages: nextPages,
        currentPage: nextPage,
        zoom,
        annotations: shiftedAnnotations,
        originalTexts: shiftedTexts,
        originalImages: shiftedImages,
        selectedObject: null,
        history: [{ annotations: shiftedAnnotations, originalTexts: shiftedTexts, originalImages: shiftedImages }],
        historyIndex: 0,
        isLoading: false,
        detectedSignatureSpots: [],
        activeSignatureSpot: null,
      })

      get().extractPageContent(nextPage)
      get().scanSignatureSpots(nextPage)
    } catch (err: any) {
      console.error('Failed to delete page:', err)
      set({
        isLoading: false,
        errorMessage: err?.message || 'Failed to delete page.',
      })
    }
  },

  duplicateCurrentPage: async () => {
    const { currentDoc, currentPage, loadDocumentFromData } = get()
    if (!currentDoc) return
    try {
      const duplicated = await PdfEditor.duplicatePage(currentDoc.data, currentPage)
      await loadDocumentFromData(duplicated, currentDoc.name, currentDoc.path)
    } catch (e) {
      console.error('Failed to duplicate page:', e)
    }
  },

  cropCurrentPage: async (crop: CropOptions) => {
    const { currentDoc, loadDocumentFromData } = get()
    if (!currentDoc) return
    try {
      const cropped = await PdfEditor.cropPage(currentDoc.data, crop)
      await loadDocumentFromData(cropped, currentDoc.name, currentDoc.path)
    } catch (e) {
      console.error('Failed to crop page:', e)
    }
  },

  setWatermark: (options: WatermarkOptions | null) => {
    set({ watermarkOptions: options })
  },

  setPageNumbers: (options: PageNumberOptions | null) => {
    set({ pageNumberOptions: options })
  },

  addAnnotation: (item) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newItem: AnnotationItem = {
      ...item,
      id,
      createdAt: Date.now(),
    }
    const current = get().annotations
    const next = [...current, newItem]
    const { history, historyIndex, originalTexts, originalImages } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      annotations: next,
      originalTexts,
      originalImages,
    })

    set({
      annotations: next,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    })
    return id
  },

  updateAnnotation: (id: string, updates: Partial<AnnotationItem>) => {
    const current = get().annotations
    const next = current.map((a) => (a.id === id ? { ...a, ...updates } : a))
    const { history, historyIndex, originalTexts, originalImages, selectedObject } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      annotations: next,
      originalTexts,
      originalImages,
    })

    const nextSelected =
      selectedObject && selectedObject.id === id
        ? { ...selectedObject, data: { ...selectedObject.data, ...updates } }
        : selectedObject

    set({
      annotations: next,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      selectedObject: nextSelected,
    })
  },

  removeAnnotation: (id: string) => {
    const current = get().annotations
    const next = current.filter((a) => a.id !== id)
    const { history, historyIndex, originalTexts, originalImages } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({
      annotations: next,
      originalTexts,
      originalImages,
    })

    set({
      annotations: next,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      selectedObject: null,
    })
  },

  clearAnnotations: () => {
    set({
      annotations: [],
    })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1
      const state = history[nextIdx]
      set({
        annotations: state.annotations,
        originalTexts: state.originalTexts,
        originalImages: state.originalImages,
        historyIndex: nextIdx,
        selectedObject: null,
      })
    }
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1
      const state = history[nextIdx]
      set({
        annotations: state.annotations,
        originalTexts: state.originalTexts,
        originalImages: state.originalImages,
        historyIndex: nextIdx,
        selectedObject: null,
      })
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  scanSignatureSpots: async (pageNumber?: number) => {
    const { pdfJsDoc, currentPage } = get()
    if (!pdfJsDoc) return
    const targetPage = pageNumber ?? currentPage
    try {
      const spots = await SignatureDetector.detectSignatureSpots(pdfJsDoc, targetPage)
      set({ detectedSignatureSpots: spots })
    } catch (e) {
      console.warn('Failed to scan signature spots:', e)
    }
  },

  setActiveSignatureSpot: (spot: DetectedSignatureSpot | null) => {
    set({ activeSignatureSpot: spot })
  },

  setSavedSignature: (dataUrl: string) => {
    set({ savedSignature: dataUrl })
    try {
      localStorage.setItem('veldora_saved_signature', dataUrl)
    } catch {
      // ignore
    }
  },

  setOcrRunning: (running: boolean) => {
    set({ isOcrRunning: running })
  },

  setOcrProgress: (progress: OcrProgress | null) => {
    set({ ocrProgress: progress })
  },

  applyOcrEditableText: (elements: PdfTextElement[]) => {
    const currentTexts = get().originalTexts
    set({
      originalTexts: [...currentTexts, ...elements],
    })
  },

  loadRecentFiles: async () => {
    const adapter = getFileAdapter()
    const recents = await adapter.readRecentFiles()
    set({ recentFiles: recents })
  },
}))
