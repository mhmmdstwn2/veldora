import React, { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Trash2,
  Check,
  X,
  Sparkles,
  Move,
  Edit2,
  Eraser,
  Plus,
  Minus,
  Image as ImageIcon,
  MessageSquare,
  CheckCircle2,
  Type as TypeIcon,
  Bold,
  Italic,
  Underline,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PdfLoader } from '@/core/pdf/pdf-loader'
import { FloatingPageTools } from '@/components/toolbar/FloatingPageTools'
import { AnnotationItem, DetectedSignatureSpot, PdfTextElement, TextRun } from '@/types'
import {
  applyRunStyleToAll,
  getEffectiveRuns,
  htmlToRuns,
  runsToHtml,
  runsToPlainText,
} from '@/core/pdf/rich-text'
import { calculateFittedDimensions, getCssFontFamily } from '@/utils/image-utils'

const CANVAS_SCALE = 1.5

export const PdfCanvasViewer: React.FC = () => {
  const {
    pdfJsDoc,
    currentPage,
    setCurrentPage,
    pages,
    zoom,
    setZoom,
    rotation,
    activeTool,
    setActiveTool,
    setActiveModal,
    color,
    fontSize,
    annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    detectedSignatureSpots,
    savedSignature,
    originalTexts,
    originalImages,
    updateOriginalText,
    commitTextEdit,
    deleteOriginalText,
    updateOriginalImage,
    deleteOriginalImage,
    selectedObject,
    setSelectedObject,
    setPropertiesOpen,
    watermarkOptions,
    pageNumberOptions,
  } = usePdfStore()

  const effectiveScale = zoom * CANVAS_SCALE

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const richEditorRef = useRef<HTMLDivElement | null>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null)

  // Selected annotation id & active open comment id
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null)
  const [openCommentId, setOpenCommentId] = useState<string | null>(null)

  // Comment composer popover state
  const [commentDraft, setCommentDraft] = useState<{
    visible: boolean
    x: number
    y: number
    text: string
    author: string
    color: string
  }>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
    author: 'Reviewer',
    color: '#f59e0b',
  })

  // Dragging reference for zero-latency smooth window dragging
  const dragRef = useRef<{
    id: string
    type: 'annotation' | 'orig-text' | 'orig-image'
    startClientX: number
    startClientY: number
    startX: number
    startY: number
  } | null>(null)

  // Interactive drawing state (highlight / rect / redact)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // Inline text editing state (Canva style with per-selection rich text runs)
  const [inlineEditor, setInlineEditor] = useState<{
    visible: boolean
    id?: string
    isOriginalText?: boolean
    x: number
    y: number
    width?: number
    height?: number
    text: string
    runs?: TextRun[]
    isWhiteout: boolean
    fontSize: number
    lineHeight?: number
    color: string
    fontFamily?: string
    fontWeight?: string | number
    fontStyle?: string
    underline?: boolean
  }>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
    runs: [],
    isWhiteout: false,
    fontSize: 14,
    color: '#000000',
    fontFamily: 'Helvetica',
  })

  const [inlineFormatState, setInlineFormatState] = useState<{
    bold: boolean
    italic: boolean
    underline: boolean
  }>({ bold: false, italic: false, underline: false })

  const refreshInlineFormatState = () => {
    try {
      setInlineFormatState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      })
    } catch {
      // ignore
    }
  }

  const syncInlineEditorFromDom = () => {
    const el = richEditorRef.current
    if (!el) return
    const nextRuns = htmlToRuns(el)
    const nextText = runsToPlainText(nextRuns)
    setInlineEditor((prev) => ({
      ...prev,
      text: nextText,
      runs: nextRuns,
    }))
    refreshInlineFormatState()
  }

  const applyInlineFormat = (cmd: 'bold' | 'italic' | 'underline') => {
    const el = richEditorRef.current
    if (!el) return
    if (document.activeElement !== el) {
      el.focus()
    }
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      const range = document.createRange()
      range.selectNodeContents(el)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    document.execCommand(cmd, false)
    syncInlineEditorFromDom()
  }

  // Render PDF page to canvas
  const currentPageInfo = pages.find((p) => p.pageNumber === currentPage)
  const pageRotation = (currentPageInfo?.rotation || 0) + rotation

  // Populate contentEditable once when inlineEditor opens & select all text
  useEffect(() => {
    if (inlineEditor.visible) {
      const timer = setTimeout(() => {
        const el = richEditorRef.current
        if (!el) return
        const initialRuns =
          inlineEditor.runs && inlineEditor.runs.length > 0
            ? inlineEditor.runs
            : getEffectiveRuns(inlineEditor)
        el.innerHTML = runsToHtml(initialRuns)
        el.focus()
        try {
          const range = document.createRange()
          range.selectNodeContents(el)
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
        } catch {
          // ignore
        }
        refreshInlineFormatState()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [inlineEditor.visible, inlineEditor.x, inlineEditor.y, inlineEditor.id])

  // Allow PropertiesPanel B/I/U buttons to format active selection inside inlineEditor
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ command: 'bold' | 'italic' | 'underline' }>).detail
      if (inlineEditor.visible && detail?.command) {
        applyInlineFormat(detail.command)
      }
    }
    window.addEventListener('veldora:format-inline', handler)
    return () => window.removeEventListener('veldora:format-inline', handler)
  }, [inlineEditor.visible])

  useEffect(() => {
    if (commentDraft.visible) {
      const timer = setTimeout(() => {
        commentTextareaRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [commentDraft.visible, commentDraft.x, commentDraft.y])

  useEffect(() => {
    let isCancelled = false

    const renderPage = async () => {
      if (!pdfJsDoc || !canvasRef.current) return
      try {
        await PdfLoader.renderPageToCanvas(pdfJsDoc, currentPage, canvasRef.current, {
          scale: zoom * 1.5,
          rotation: pageRotation,
        })

        // Auto-capture rendered pixels for any embedded original image on this page
        const canvas = canvasRef.current
        if (canvas) {
          const currentImages = usePdfStore
            .getState()
            .originalImages.filter((img) => img.pageNumber === currentPage)
          for (const img of currentImages) {
            if (!img.dataUrl && !img.replacementDataUrl && !img.isDeleted) {
              try {
                const ox = Math.round(((img.origX ?? img.x) / 100) * canvas.width)
                const oy = Math.round(((img.origY ?? img.y) / 100) * canvas.height)
                const ow = Math.round(((img.origWidth ?? img.width) / 100) * canvas.width)
                const oh = Math.round(((img.origHeight ?? img.height) / 100) * canvas.height)
                // Inset by 1px so adjacent table lines or borders are not captured inside the image
                const insetX = ow > 20 ? 1 : 0
                const insetY = oh > 20 ? 1 : 0
                const safeX = Math.max(0, Math.min(canvas.width - 2, ox + insetX))
                const safeY = Math.max(0, Math.min(canvas.height - 2, oy + insetY))
                const safeW = Math.max(2, Math.min(canvas.width - safeX, ow - insetX * 2))
                const safeH = Math.max(2, Math.min(canvas.height - safeY, oh - insetY * 2))
                if (safeW > 4 && safeH > 4) {
                  const tempCanvas = document.createElement('canvas')
                  tempCanvas.width = safeW
                  tempCanvas.height = safeH
                  const tCtx = tempCanvas.getContext('2d')
                  if (tCtx) {
                    tCtx.drawImage(canvas, safeX, safeY, safeW, safeH, 0, 0, safeW, safeH)
                    const captured = tempCanvas.toDataURL('image/png')
                    updateOriginalImage(img.id, {
                      dataUrl: captured,
                      isModified: img.isModified || false,
                    })
                  }
                }
              } catch (e) {
                console.warn('Canvas auto-snip error:', e)
              }
            }
          }

          // Auto-sample real background color for text elements on this page
          const currentTexts = usePdfStore
            .getState()
            .originalTexts.filter((t) => t.pageNumber === currentPage)
          const ctx = canvas.getContext('2d')
          if (ctx && currentTexts.length > 0) {
            const updatesMap = new Map<string, string>()
            for (const t of currentTexts) {
              if (!t.backgroundColor) {
                try {
                  const ox = Math.round(((t.origX ?? t.x) / 100) * canvas.width)
                  const oy = Math.round(((t.origY ?? t.y) / 100) * canvas.height)
                  const ow = Math.round(((t.origWidth ?? t.width) / 100) * canvas.width)
                  const oh = Math.round(((t.origHeight ?? t.height) / 100) * canvas.height)

                  const sampleCoords = [
                    { x: Math.max(0, Math.min(canvas.width - 1, ox + 2)), y: Math.max(0, oy - 2) },
                    { x: Math.max(0, Math.min(canvas.width - 1, ox + ow - 2)), y: Math.max(0, oy - 2) },
                    { x: Math.max(0, ox - 3), y: Math.min(canvas.height - 1, oy + Math.round(oh / 2)) },
                    { x: Math.min(canvas.width - 1, ox + ow + 3), y: Math.min(canvas.height - 1, oy + Math.round(oh / 2)) },
                    { x: Math.max(0, Math.min(canvas.width - 1, ox + 2)), y: Math.min(canvas.height - 1, oy + oh + 2) },
                    { x: Math.max(0, Math.min(canvas.width - 1, ox + ow - 2)), y: Math.min(canvas.height - 1, oy + oh + 2) },
                    { x: Math.max(0, Math.min(canvas.width - 1, ox + 1)), y: Math.max(0, Math.min(canvas.height - 1, oy + 1)) },
                    { x: Math.max(0, Math.min(canvas.width - 1, ox + ow - 2)), y: Math.max(0, Math.min(canvas.height - 1, oy + 1)) },
                  ]

                  const colorCounts: Record<string, { count: number; r: number; g: number; b: number }> = {}
                  for (const pt of sampleCoords) {
                    const p = ctx.getImageData(pt.x, pt.y, 1, 1).data
                    if (p[3] < 50) continue
                    const key = `${Math.round(p[0] / 4) * 4},${Math.round(p[1] / 4) * 4},${Math.round(p[2] / 4) * 4}`
                    if (!colorCounts[key]) {
                      colorCounts[key] = { count: 0, r: p[0], g: p[1], b: p[2] }
                    }
                    colorCounts[key].count++
                  }

                  let best = { count: 0, r: 255, g: 255, b: 255 }
                  for (const k in colorCounts) {
                    if (colorCounts[k].count > best.count) {
                      best = colorCounts[k]
                    }
                  }

                  const toHex = (n: number) => n.toString(16).padStart(2, '0')
                  const hexBg = `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`
                  updatesMap.set(t.id, hexBg)
                } catch (e) {
                  console.warn('Text background sampling error:', e)
                }
              }
            }

            if (updatesMap.size > 0) {
              usePdfStore.setState((state) => ({
                originalTexts: state.originalTexts.map((t) =>
                  updatesMap.has(t.id) ? { ...t, backgroundColor: updatesMap.get(t.id)! } : t
                ),
              }))
            }
          }
        }
      } catch (err: any) {
        if (!isCancelled && err?.name !== 'RenderingCancelledException') {
          console.error('Render error:', err)
        }
      }
    }

    renderPage()

    return () => {
      isCancelled = true
    }
  }, [pdfJsDoc, currentPage, zoom, pageRotation])

  // Auto-capture rendered pixels for original images whenever images or canvas update
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !pdfJsDoc) return

    const currentImages = originalImages.filter((img) => img.pageNumber === currentPage)
    for (const img of currentImages) {
      if (!img.dataUrl && !img.replacementDataUrl && !img.isDeleted) {
        try {
          const ox = Math.round(((img.origX ?? img.x) / 100) * canvas.width)
          const oy = Math.round(((img.origY ?? img.y) / 100) * canvas.height)
          const ow = Math.round(((img.origWidth ?? img.width) / 100) * canvas.width)
          const oh = Math.round(((img.origHeight ?? img.height) / 100) * canvas.height)
          // Inset by 1px so adjacent table lines or borders are not captured inside the image
          const insetX = ow > 20 ? 1 : 0
          const insetY = oh > 20 ? 1 : 0
          const safeX = Math.max(0, Math.min(canvas.width - 2, ox + insetX))
          const safeY = Math.max(0, Math.min(canvas.height - 2, oy + insetY))
          const safeW = Math.max(2, Math.min(canvas.width - safeX, ow - insetX * 2))
          const safeH = Math.max(2, Math.min(canvas.height - safeY, oh - insetY * 2))
          if (safeW > 4 && safeH > 4) {
            const tempCanvas = document.createElement('canvas')
            tempCanvas.width = safeW
            tempCanvas.height = safeH
            const tCtx = tempCanvas.getContext('2d')
            if (tCtx) {
              tCtx.drawImage(canvas, safeX, safeY, safeW, safeH, 0, 0, safeW, safeH)
              const captured = tempCanvas.toDataURL('image/png')
              updateOriginalImage(img.id, {
                dataUrl: captured,
                isModified: img.isModified || false,
              })
            }
          }
        } catch (e) {
          console.warn('Canvas effect auto-snip error:', e)
        }
      }
    }
  }, [originalImages, currentPage])

  // Get mouse coordinates strictly relative to the PDF Canvas (0 - 100%)
  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()

    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    if (x < 0 || x > 100 || y < 0 || y > 100) return null
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  // Mouse event handlers for creating annotations on the canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e)
    if (!coords) {
      if (inlineEditor.visible) commitInlineText()
      setSelectedAnnId(null)
      setSelectedObject(null)
      setOpenCommentId(null)
      return
    }

    if (activeTool === 'text' || activeTool === 'whiteout') {
      e.preventDefault()
      if (inlineEditor.visible) {
        commitInlineText()
        return
      }
      setCommentDraft((prev) => ({ ...prev, visible: false }))
      setOpenCommentId(null)
      setInlineEditor({
        visible: true,
        isOriginalText: false,
        x: coords.x,
        y: coords.y,
        text: '',
        isWhiteout: activeTool === 'whiteout',
        fontSize,
        color: activeTool === 'whiteout' ? '#0f172a' : color,
        fontFamily: 'Helvetica',
      })
      return
    }

    if (activeTool === 'comment') {
      e.preventDefault()
      if (inlineEditor.visible) commitInlineText()
      setOpenCommentId(null)
      setSelectedAnnId(null)
      setCommentDraft({
        visible: true,
        x: Math.min(82, coords.x),
        y: Math.min(85, coords.y),
        text: '',
        author: 'Reviewer',
        color: '#f59e0b',
      })
      return
    }

    if (
      activeTool === 'highlight' ||
      activeTool === 'rect' ||
      activeTool === 'circle' ||
      activeTool === 'line' ||
      activeTool === 'arrow' ||
      activeTool === 'redact'
    ) {
      setIsDrawing(true)
      setStartPos(coords)
      setCurrentBox({ x: coords.x, y: coords.y, w: 0, h: 0 })
    } else {
      // Commit active inline text when clicking elsewhere on empty canvas
      if (inlineEditor.visible) {
        commitInlineText()
        return
      }
      // Clicking on empty canvas space deselects
      setSelectedAnnId(null)
      setSelectedObject(null)
      setOpenCommentId(null)
      if (commentDraft.visible && !commentDraft.text.trim()) {
        setCommentDraft((prev) => ({ ...prev, visible: false }))
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return
    const coords = getCanvasCoords(e)
    if (!coords) return

    if (activeTool === 'line' || activeTool === 'arrow') {
      setCurrentBox({
        x: startPos.x,
        y: startPos.y,
        w: coords.x - startPos.x,
        h: coords.y - startPos.y,
      })
      return
    }

    const minX = Math.min(startPos.x, coords.x)
    const minY = Math.min(startPos.y, coords.y)
    const width = Math.abs(coords.x - startPos.x)
    const height = Math.abs(coords.y - startPos.y)

    setCurrentBox({ x: minX, y: minY, w: width, h: height })
  }

  const handleMouseUp = () => {
    if (
      isDrawing &&
      currentBox &&
      (Math.abs(currentBox.w) > 0.5 || Math.abs(currentBox.h) > 0.5)
    ) {
      let createdId: string | null = null
      if (activeTool === 'highlight') {
        createdId = addAnnotation({
          type: 'highlight',
          pageNumber: currentPage,
          x: currentBox.x,
          y: currentBox.y,
          width: currentBox.w,
          height: currentBox.h,
          color,
          opacity: 0.35,
        })
      } else if (
        activeTool === 'rect' ||
        activeTool === 'circle' ||
        activeTool === 'line' ||
        activeTool === 'arrow'
      ) {
        createdId = addAnnotation({
          type: 'shape',
          shapeType: activeTool,
          pageNumber: currentPage,
          x: currentBox.x,
          y: currentBox.y,
          width: currentBox.w,
          height: currentBox.h,
          color,
          strokeWidth: 2,
        })
      } else if (activeTool === 'redact') {
        createdId = addAnnotation({
          type: 'redact',
          pageNumber: currentPage,
          x: currentBox.x,
          y: currentBox.y,
          width: currentBox.w,
          height: currentBox.h,
          color: '#000000',
        })
      }
      if (createdId) {
        setSelectedAnnId(createdId)
      }
    }
    setIsDrawing(false)
    setStartPos(null)
    setCurrentBox(null)
  }

  // Commit inline text addition or edit
  const commitInlineText = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    const finalRuns = richEditorRef.current
      ? htmlToRuns(richEditorRef.current)
      : inlineEditor.runs || []
    const finalText = richEditorRef.current
      ? runsToPlainText(finalRuns)
      : inlineEditor.text

    if (finalText.trim()) {
      if (inlineEditor.isOriginalText && inlineEditor.id) {
        // True PDF modification: updates content stream and re-renders canvas natively
        const targetTxt = pageOriginalTexts.find((t) => t.id === inlineEditor.id)
        const oldLen = Math.max(1, (targetTxt?.originalText || '').length)
        const newLen = finalText.length
        let autoWidth = targetTxt?.width || inlineEditor.width
        if (newLen > oldLen && autoWidth) {
          const ratio = newLen / oldLen
          autoWidth = Math.max(autoWidth, (targetTxt?.origWidth || autoWidth) * ratio * 1.05)
        }

        commitTextEdit(inlineEditor.id, {
          text: finalText,
          runs: finalRuns,
          fontSize: inlineEditor.fontSize,
          color: inlineEditor.color,
          fontFamily: inlineEditor.fontFamily,
          fontWeight: inlineEditor.fontWeight,
          fontStyle: inlineEditor.fontStyle,
          underline: inlineEditor.underline,
          width: autoWidth ? Math.round(autoWidth * 10) / 10 : undefined,
          isModified: true,
        })
      } else if (inlineEditor.id) {
        updateAnnotation(inlineEditor.id, {
          text: finalText,
          runs: finalRuns,
          fontSize: inlineEditor.fontSize,
          color: inlineEditor.color,
          backgroundColor: inlineEditor.isWhiteout ? '#ffffff' : undefined,
        })
      } else {
        addAnnotation({
          type: 'text',
          pageNumber: currentPage,
          x: inlineEditor.x,
          y: inlineEditor.y,
          text: finalText,
          runs: finalRuns,
          color: inlineEditor.color,
          fontSize: inlineEditor.fontSize,
          fontFamily: inlineEditor.fontFamily,
          backgroundColor: inlineEditor.isWhiteout ? '#ffffff' : undefined,
        })
      }
    }
    setInlineEditor({
      visible: false,
      x: 0,
      y: 0,
      text: '',
      runs: [],
      isWhiteout: false,
      fontSize: 14,
      color: '#000000',
      fontFamily: 'Helvetica',
    })
    setActiveTool('select')
  }

  // Cancel inline text without saving
  const cancelInlineText = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setInlineEditor({
      visible: false,
      x: 0,
      y: 0,
      text: '',
      isWhiteout: false,
      fontSize: 14,
      color: '#000000',
      fontFamily: 'Helvetica',
    })
    setActiveTool('select')
  }

  // Commit or cancel comment draft
  const commitCommentDraft = () => {
    const trimmed = commentDraft.text.trim()
    if (trimmed) {
      const newId = addAnnotation({
        type: 'comment',
        pageNumber: currentPage,
        x: commentDraft.x,
        y: commentDraft.y,
        text: trimmed,
        author: commentDraft.author.trim() || 'Reviewer',
        color: commentDraft.color,
        resolved: false,
      })
      const created = usePdfStore.getState().annotations.find((a) => a.id === newId)
      setSelectedAnnId(newId)
      if (created) {
        setSelectedObject({ type: 'annotation', id: newId, data: created })
        setPropertiesOpen(true)
      }
      setOpenCommentId(newId)
    }
    setCommentDraft((prev) => ({ ...prev, visible: false, text: '' }))
    setActiveTool('select')
  }

  // Generic Drag Handler for Annotations, Original Texts, and Original Images
  const startDragItem = (
    e: React.MouseEvent,
    id: string,
    type: 'annotation' | 'orig-text' | 'orig-image',
    currentX: number,
    currentY: number
  ) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canvasRef.current) return

    let clickedAnnotation: AnnotationItem | undefined
    if (type === 'annotation') {
      setSelectedAnnId(id)
      clickedAnnotation = annotations.find((a) => a.id === id)
      if (clickedAnnotation) {
        if (clickedAnnotation.type === 'text') {
          setSelectedObject({ type: 'text', id, data: clickedAnnotation })
        } else if (clickedAnnotation.type === 'image') {
          setSelectedObject({ type: 'image', id, data: clickedAnnotation })
        } else {
          setSelectedObject({ type: 'annotation', id, data: clickedAnnotation })
        }
        setPropertiesOpen(true)
      }
    } else if (type === 'orig-text') {
      const origTxt = originalTexts.find((t) => t.id === id)
      if (origTxt) {
        setSelectedObject({ type: 'text', id, data: origTxt })
        setPropertiesOpen(true)
      }
    } else if (type === 'orig-image') {
      const origImg = originalImages.find((img) => img.id === id)
      if (origImg) {
        setSelectedObject({ type: 'image', id, data: origImg })
        setPropertiesOpen(true)

        // FAIL-SAFE: If dataUrl is not ready, snip directly from the active canvas
        if (!origImg.dataUrl && !origImg.replacementDataUrl && canvasRef.current) {
          try {
            const canvas = canvasRef.current
            const ox = Math.round(((origImg.origX ?? origImg.x) / 100) * canvas.width)
            const oy = Math.round(((origImg.origY ?? origImg.y) / 100) * canvas.height)
            const ow = Math.round(((origImg.origWidth ?? origImg.width) / 100) * canvas.width)
            const oh = Math.round(((origImg.origHeight ?? origImg.height) / 100) * canvas.height)
            const safeX = Math.max(0, Math.min(canvas.width - 2, ox))
            const safeY = Math.max(0, Math.min(canvas.height - 2, oy))
            const safeW = Math.max(2, Math.min(canvas.width - safeX, ow))
            const safeH = Math.max(2, Math.min(canvas.height - safeY, oh))
            if (safeW > 4 && safeH > 4) {
              const tempCanvas = document.createElement('canvas')
              tempCanvas.width = safeW
              tempCanvas.height = safeH
              const tCtx = tempCanvas.getContext('2d')
              if (tCtx) {
                tCtx.drawImage(canvas, safeX, safeY, safeW, safeH, 0, 0, safeW, safeH)
                const captured = tempCanvas.toDataURL('image/png')
                updateOriginalImage(id, {
                  dataUrl: captured,
                  isModified: origImg.isModified || false,
                })
              }
            }
          } catch (e) {
            console.warn('Canvas snip on drag start failed:', e)
          }
        }
      }
    }

    dragRef.current = {
      id,
      type,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: currentX,
      startY: currentY,
    }

    let hasDragged = false

    const onGlobalMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current || !canvasRef.current) return

      const moveDist = Math.hypot(
        moveEvent.clientX - dragRef.current.startClientX,
        moveEvent.clientY - dragRef.current.startClientY
      )

      // THRESHOLD: Require minimum 5px mouse move to initiate dragging (prevents clicks from mutating)
      if (!hasDragged && moveDist < 5) {
        return
      }
      hasDragged = true

      const canvasRect = canvasRef.current.getBoundingClientRect()
      const deltaXPercent =
        ((moveEvent.clientX - dragRef.current.startClientX) / canvasRect.width) * 100
      const deltaYPercent =
        ((moveEvent.clientY - dragRef.current.startClientY) / canvasRect.height) * 100

      const nextX = Math.max(0, Math.min(95, dragRef.current.startX + deltaXPercent))
      const nextY = Math.max(0, Math.min(95, dragRef.current.startY + deltaYPercent))
      const roundedX = Math.round(nextX * 10) / 10
      const roundedY = Math.round(nextY * 10) / 10

      if (dragRef.current.type === 'annotation') {
        updateAnnotation(dragRef.current.id, { x: roundedX, y: roundedY })
      } else if (dragRef.current.type === 'orig-text') {
        updateOriginalText(dragRef.current.id, { x: roundedX, y: roundedY, isModified: true })
      } else if (dragRef.current.type === 'orig-image') {
        updateOriginalImage(dragRef.current.id, { x: roundedX, y: roundedY, isModified: true })
      }
    }

    const onGlobalMouseUp = () => {
      if (!hasDragged && clickedAnnotation?.type === 'comment') {
        setOpenCommentId((prev) =>
          prev === clickedAnnotation!.id ? null : clickedAnnotation!.id
        )
      }
      dragRef.current = null
      window.removeEventListener('mousemove', onGlobalMouseMove)
      window.removeEventListener('mouseup', onGlobalMouseUp)
    }

    window.addEventListener('mousemove', onGlobalMouseMove)
    window.addEventListener('mouseup', onGlobalMouseUp)
  }

  // Canva-Style Proportional Corner Resize for Images
  const startResizeImage = (
    e: React.MouseEvent,
    imgId: string,
    corner: 'se' | 'sw' | 'ne' | 'nw',
    currentX: number,
    currentY: number,
    currentW: number,
    currentH: number
  ) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canvasRef.current) return

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const startClientX = e.clientX
    const aspect = currentW / currentH

    const onMove = (moveEv: MouseEvent) => {
      const deltaXPercent = ((moveEv.clientX - startClientX) / canvasRect.width) * 100
      let nextW = currentW
      let nextH = currentH
      let nextX = currentX
      let nextY = currentY

      if (corner === 'se') {
        nextW = Math.max(5, Math.min(95 - currentX, currentW + deltaXPercent))
        nextH = Math.max(3, Math.min(95 - currentY, nextW / aspect))
      } else if (corner === 'sw') {
        nextW = Math.max(5, Math.min(currentX + currentW, currentW - deltaXPercent))
        nextH = Math.max(3, nextW / aspect)
        nextX = currentX + (currentW - nextW)
      } else if (corner === 'ne') {
        nextW = Math.max(5, Math.min(95 - currentX, currentW + deltaXPercent))
        nextH = Math.max(3, nextW / aspect)
        nextY = currentY + (currentH - nextH)
      } else if (corner === 'nw') {
        nextW = Math.max(5, currentW - deltaXPercent)
        nextH = Math.max(3, nextW / aspect)
        nextX = currentX + (currentW - nextW)
        nextY = currentY + (currentH - nextH)
      }

      updateOriginalImage(imgId, {
        x: Math.round(nextX * 10) / 10,
        y: Math.round(nextY * 10) / 10,
        width: Math.round(nextW * 10) / 10,
        height: Math.round(nextH * 10) / 10,
        isModified: true,
      })
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Canva-Style Text Box Resize: Side handles for width (single line), Corner handles for font size
  const startResizeText = (
    e: React.MouseEvent,
    txtId: string,
    handle: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w',
    currentX: number,
    currentY: number,
    currentW: number,
    currentH: number,
    startFontSize: number
  ) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canvasRef.current) return

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const startClientX = e.clientX

    const onMove = (moveEv: MouseEvent) => {
      const deltaXPercent = ((moveEv.clientX - startClientX) / canvasRect.width) * 100

      let nextX = currentX
      let nextY = currentY
      let nextW = currentW
      let nextH = currentH
      let nextFontSize = startFontSize

      if (handle === 'e') {
        // Dragging right handle expands width to make text fit on 1 line
        nextW = Math.max(2, Math.min(98 - currentX, currentW + deltaXPercent))
      } else if (handle === 'w') {
        // Dragging left handle expands width to the left
        nextW = Math.max(2, Math.min(currentX + currentW, currentW - deltaXPercent))
        nextX = currentX + (currentW - nextW)
      } else {
        // Corner handles: scales font size AND box dimensions proportionally
        let scaleFactor = 1.0
        if (handle === 'se') {
          const rawW = currentW + deltaXPercent
          scaleFactor = Math.max(0.3, rawW / Math.max(1, currentW))
          nextW = currentW * scaleFactor
          nextH = currentH * scaleFactor
        } else if (handle === 'sw') {
          const rawW = currentW - deltaXPercent
          scaleFactor = Math.max(0.3, rawW / Math.max(1, currentW))
          nextW = currentW * scaleFactor
          nextH = currentH * scaleFactor
          nextX = currentX + (currentW - nextW)
        } else if (handle === 'ne') {
          const rawW = currentW + deltaXPercent
          scaleFactor = Math.max(0.3, rawW / Math.max(1, currentW))
          nextW = currentW * scaleFactor
          nextH = currentH * scaleFactor
          nextY = currentY + (currentH - nextH)
        } else if (handle === 'nw') {
          const rawW = currentW - deltaXPercent
          scaleFactor = Math.max(0.3, rawW / Math.max(1, currentW))
          nextW = currentW * scaleFactor
          nextH = currentH * scaleFactor
          nextX = currentX + (currentW - nextW)
          nextY = currentY + (currentH - nextH)
        }
        nextFontSize = Math.max(6, Math.min(120, Math.round(startFontSize * scaleFactor * 10) / 10))
      }

      updateOriginalText(txtId, {
        x: Math.round(nextX * 10) / 10,
        y: Math.round(nextY * 10) / 10,
        width: Math.round(nextW * 10) / 10,
        height: Math.round(nextH * 10) / 10,
        fontSize: nextFontSize,
        isModified: true,
      })
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Resize annotation with +/- buttons
  const handleResizeAnnotation = (
    e: React.MouseEvent,
    ann: AnnotationItem,
    delta: number
  ) => {
    e.stopPropagation()
    const currentW = ann.width || (ann.type === 'signature' ? 22 : 20)
    const currentH = ann.height || (ann.type === 'signature' ? 8 : 10)
    const factor = delta > 0 ? 1.15 : 0.88

    updateAnnotation(ann.id, {
      width: Math.round(Math.max(5, Math.min(80, currentW * factor)) * 10) / 10,
      height: Math.round(Math.max(2, Math.min(50, currentH * factor)) * 10) / 10,
    })
  }

  // Drag corner handle to resize annotation smoothly
  const startResizeAnnotationBox = (
    e: React.MouseEvent,
    ann: AnnotationItem
  ) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canvasRef.current) return

    const canvasRect = canvasRef.current.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const origW = ann.width || 25
    const origH = ann.height || 15
    const preserveAspect = ann.type === 'image' || ann.type === 'signature'
    const aspect = origW / Math.max(1, origH)

    const onMove = (moveEv: MouseEvent) => {
      const dxPct = ((moveEv.clientX - startX) / canvasRect.width) * 100
      const dyPct = ((moveEv.clientY - startY) / canvasRect.height) * 100
      const nextW = Math.max(4, Math.min(95 - ann.x, origW + dxPct))
      const nextH = preserveAspect
        ? Math.max(3, Math.min(95 - ann.y, nextW / aspect))
        : Math.max(2, Math.min(95 - ann.y, origH + dyPct))

      updateAnnotation(ann.id, {
        width: Math.round(nextW * 10) / 10,
        height: Math.round(nextH * 10) / 10,
      })
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Double click added text annotation to edit inline properly
  const handleDoubleClickAnnotationText = (e: React.MouseEvent, ann: AnnotationItem) => {
    e.stopPropagation()
    setSelectedAnnId(ann.id)
    setSelectedObject({ type: 'text', id: ann.id, data: ann })
    setPropertiesOpen(true)
    setInlineEditor({
      visible: true,
      id: ann.id,
      isOriginalText: false,
      x: ann.x,
      y: ann.y,
      width: ann.width,
      height: ann.height,
      text: ann.text || '',
      runs: getEffectiveRuns(ann),
      isWhiteout: !!ann.backgroundColor,
      fontSize: ann.fontSize || 14,
      color: ann.color || '#0f172a',
      fontFamily: ann.fontFamily || 'Helvetica',
      fontWeight: ann.fontWeight,
      fontStyle: ann.fontStyle,
      underline: ann.underline,
    })
  }

  // Double click original text element to edit in-place (Canva style)
  const handleDoubleClickOriginalText = (e: React.MouseEvent, txt: PdfTextElement) => {
    e.stopPropagation()
    setSelectedObject({ type: 'text', id: txt.id, data: txt })
    setPropertiesOpen(true)
    setInlineEditor({
      visible: true,
      id: txt.id,
      isOriginalText: true,
      x: txt.x,
      y: txt.y,
      width: txt.width,
      height: txt.height,
      text: txt.text,
      runs: getEffectiveRuns(txt),
      isWhiteout: true,
      fontSize: txt.fontSize || 12,
      lineHeight: txt.lineHeight,
      color: txt.color || '#000000',
      fontFamily: txt.fontFamily || 'Helvetica',
      fontWeight: txt.fontWeight ?? (txt.fontFamily?.includes('Bold') ? 700 : 400),
      fontStyle: txt.fontStyle ?? (txt.fontFamily?.includes('Italic') ? 'italic' : 'normal'),
      underline: txt.underline,
    })
  }

  // Trigger image replacement file picker
  const triggerImageReplace = (e: React.MouseEvent, imgId: string) => {
    e.stopPropagation()
    setReplacingImageId(imgId)
    fileInputRef.current?.click()
  }

  const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !replacingImageId) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (dataUrl) {
        const targetImg = originalImages.find((im) => im.id === replacingImageId)
        const imgObj = new Image()
        imgObj.onload = () => {
          const dims = targetImg
            ? calculateFittedDimensions(
              targetImg.width,
              targetImg.height,
              imgObj.naturalWidth,
              imgObj.naturalHeight
            )
            : undefined

          // Convert to PNG via offscreen canvas so it's guaranteed 100% compatible with pdf-lib
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = imgObj.naturalWidth
          tempCanvas.height = imgObj.naturalHeight
          const tCtx = tempCanvas.getContext('2d')
          let finalPngUrl = dataUrl
          if (tCtx) {
            tCtx.drawImage(imgObj, 0, 0)
            finalPngUrl = tempCanvas.toDataURL('image/png')
          }

          updateOriginalImage(replacingImageId, {
            replacementDataUrl: finalPngUrl,
            width: dims?.width ?? targetImg?.width,
            height: dims?.height ?? targetImg?.height,
            isDeleted: false,
            isModified: true,
          })
        }
        imgObj.src = dataUrl
      }
      setReplacingImageId(null)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Global keyboard shortcuts (Delete / Backspace to remove selected object, Ctrl +/- to zoom)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Zoom shortcuts: Ctrl + '=', Ctrl + '+', Ctrl + '-', Ctrl + '0'
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          const currentZoom = usePdfStore.getState().zoom
          usePdfStore.getState().setZoom(Math.min(5.0, Math.round((currentZoom + 0.15) * 100) / 100))
          return
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          const currentZoom = usePdfStore.getState().zoom
          usePdfStore.getState().setZoom(Math.max(0.25, Math.round((currentZoom - 0.15) * 100) / 100))
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          usePdfStore.getState().setZoom(1.0)
          return
        }
      }

      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        inlineEditor.visible
      ) {
        return
      }

      // Formatting shortcuts (Ctrl+B, Ctrl+I, Ctrl+U) when a text object is selected
      if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) {
        const state = usePdfStore.getState()
        const selObj = state.selectedObject
        if (selObj?.type === 'text') {
          e.preventDefault()
          const cmd = e.key.toLowerCase()
          const isOrig = state.originalTexts.some((t) => t.id === selObj.id)
          const item = isOrig
            ? state.originalTexts.find((t) => t.id === selObj.id)
            : state.annotations.find((a) => a.id === selObj.id)
          if (item) {
            const runs = getEffectiveRuns(item)
            if (cmd === 'b') {
              const allBold = runs.length > 0 && runs.every((r) => r.bold)
              const nextRuns = applyRunStyleToAll(runs, { bold: !allBold })
              if (isOrig) {
                updateOriginalText(item.id, { runs: nextRuns, fontWeight: !allBold ? 700 : 400, isModified: true })
              } else {
                updateAnnotation(item.id, { runs: nextRuns, fontWeight: !allBold ? 700 : 400 })
              }
            } else if (cmd === 'i') {
              const allItalic = runs.length > 0 && runs.every((r) => r.italic)
              const nextRuns = applyRunStyleToAll(runs, { italic: !allItalic })
              if (isOrig) {
                updateOriginalText(item.id, { runs: nextRuns, fontStyle: !allItalic ? 'italic' : 'normal', isModified: true })
              } else {
                updateAnnotation(item.id, { runs: nextRuns, fontStyle: !allItalic ? 'italic' : 'normal' })
              }
            } else if (cmd === 'u') {
              const allUnderline = runs.length > 0 && runs.every((r) => r.underline)
              const nextRuns = applyRunStyleToAll(runs, { underline: !allUnderline })
              if (isOrig) {
                updateOriginalText(item.id, { runs: nextRuns, underline: !allUnderline, isModified: true })
              } else {
                updateAnnotation(item.id, { runs: nextRuns, underline: !allUnderline })
              }
            }
          }
          return
        }
      }

      if (e.key === 'Escape') {
        setSelectedObject(null)
        setSelectedAnnId(null)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObject?.type === 'image') {
          e.preventDefault()
          deleteOriginalImage(selectedObject.id)
        } else if (selectedObject?.type === 'text') {
          e.preventDefault()
          deleteOriginalText(selectedObject.id)
        } else if (selectedAnnId) {
          e.preventDefault()
          removeAnnotation(selectedAnnId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedObject,
    selectedAnnId,
    inlineEditor.visible,
    deleteOriginalImage,
    deleteOriginalText,
    removeAnnotation,
  ])

  // Mouse wheel with Ctrl and Touchpad Pinch-to-zoom on container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()

        const currentZoom = usePdfStore.getState().zoom
        let delta = -e.deltaY * 0.002
        delta = Math.max(-0.35, Math.min(0.35, delta))
        const zoomFactor = 1 + delta
        const nextZoom = Math.max(0.25, Math.min(5.0, Math.round(currentZoom * zoomFactor * 100) / 100))

        if (Math.abs(nextZoom - currentZoom) >= 0.005) {
          const rect = container.getBoundingClientRect()
          const mouseX = e.clientX - rect.left
          const mouseY = e.clientY - rect.top

          const scrollLeft = container.scrollLeft
          const scrollTop = container.scrollTop

          const contentX = scrollLeft + mouseX
          const contentY = scrollTop + mouseY

          const scaleRatio = nextZoom / currentZoom

          usePdfStore.getState().setZoom(nextZoom)

          requestAnimationFrame(() => {
            if (container) {
              container.scrollLeft = contentX * scaleRatio - mouseX
              container.scrollTop = contentY * scaleRatio - mouseY
            }
          })
        }
      }
    }

    // Prevent Electron window from zooming globally when Ctrl+Wheel is used outside container
    const handleGlobalWheel = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        e.preventDefault()
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('wheel', handleGlobalWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
      window.removeEventListener('wheel', handleGlobalWheel)
    }
  }, [])

  // Handle clicking on an auto-detected signature spot on canvas
  const handleSpotClick = (e: React.MouseEvent, spot: DetectedSignatureSpot) => {
    e.stopPropagation()

    if (savedSignature) {
      const newId = addAnnotation({
        type: 'signature',
        pageNumber: currentPage,
        x: spot.x,
        y: spot.y,
        width: spot.width,
        height: spot.height,
        dataUrl: savedSignature,
      })
      setSelectedAnnId(newId)
      setActiveTool('select')
    } else {
      setActiveTool('sign')
      setActiveModal('sign')
    }
  }

  const pageAnnotations = annotations.filter((a) => a.pageNumber === currentPage)
  const pageOriginalTexts = originalTexts.filter((t) => t.pageNumber === currentPage)
  const pageOriginalImages = originalImages.filter((img) => img.pageNumber === currentPage)

  // Only display signature spot overlays when user is explicitly using the Sign tool
  const showDetectedSpots = activeTool === 'sign'
  const unfilledSpots = detectedSignatureSpots.filter(
    (s) =>
      s.pageNumber === currentPage &&
      !pageAnnotations.some(
        (a) =>
          a.type === 'signature' &&
          Math.abs(a.x - s.x) < 5 &&
          Math.abs(a.y - s.y) < 5
      )
  )

  const isEditingTextMode = activeTool === 'edit-text' || activeTool === 'select'
  const isEditingImageMode = activeTool === 'edit-image' || activeTool === 'select'
  const isBlankPage =
    pageOriginalTexts.length === 0 &&
    pageOriginalImages.length === 0 &&
    pageAnnotations.length === 0
  const isDrawingCursorTool =
    activeTool === 'text' ||
    activeTool === 'whiteout' ||
    activeTool === 'comment' ||
    activeTool === 'highlight' ||
    activeTool === 'rect' ||
    activeTool === 'circle' ||
    activeTool === 'line' ||
    activeTool === 'arrow' ||
    activeTool === 'redact'

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-[#0b0c10] overflow-auto flex flex-col items-center justify-start p-8 relative select-none"
    >
      {/* Hidden file input for original image replacement */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleImageFileSelected}
      />

      {/* Floating Vertical Page Sidebar Tools */}
      <FloatingPageTools />

      {/* Canvas Paper Container */}
      <div
        className={`relative shadow-2xl transition-transform duration-75 inline-block ${
          isDrawingCursorTool ? 'cursor-crosshair' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Actual PDF.js Canvas */}
        <canvas
          ref={canvasRef}
          className="bg-white block rounded-sm shadow-black/70 shadow-2xl"
        />

        {/* 1. ORIGINAL PDF EMBEDDED IMAGES (z-15, under text) */}
        {pageOriginalImages.map((img, i) => {
          const isDeleted = !!img.isDeleted
          const isReplaced = !!img.replacementDataUrl
          const isMoved =
            (img.origX !== undefined && Math.abs(img.x - img.origX) > 0.1) ||
            (img.origY !== undefined && Math.abs(img.y - img.origY) > 0.1)
          const isScaled =
            (img.origWidth !== undefined && Math.abs(img.width - img.origWidth) > 0.2) ||
            (img.origHeight !== undefined && Math.abs(img.height - img.origHeight) > 0.2)
          const isModified = !!img.isModified || isMoved || isScaled
          const isSelected = selectedObject?.type === 'image' && selectedObject.id === img.id

          const origX = img.origX ?? img.x
          const origY = img.origY ?? img.y
          const origW = img.origWidth ?? img.width
          const origH = img.origHeight ?? img.height

          // Active floating image to display at current (x, y)
          const activeImageSrc = img.replacementDataUrl || img.dataUrl

          // Needs whiteout over original location if deleted, or (replaced/modified and active image source is ready)
          const needsWhiteout = isDeleted || ((isReplaced || isModified) && !!activeImageSrc)

          return (
            <React.Fragment key={img.id}>
              {/* Clean whiteout patch over ORIGINAL position */}
              {needsWhiteout && (
                <div
                  className="absolute bg-white pointer-events-none z-12"
                  style={{
                    left: `${origX}%`,
                    top: `${origY}%`,
                    width: `${origW}%`,
                    height: `${origH}%`,
                  }}
                />
              )}

              {/* Floating Image (when replaced, moved, or scaled) */}
              {!isDeleted && (isReplaced || isModified) && activeImageSrc && (
                <div
                  className="absolute pointer-events-none z-24"
                  style={{
                    left: `${img.x}%`,
                    top: `${img.y}%`,
                    width: `${img.width}%`,
                    height: `${img.height}%`,
                  }}
                >
                  <img
                    src={activeImageSrc}
                    alt={`Image #${i + 1}`}
                    className="w-full h-full object-contain block"
                  />
                </div>
              )}

              {/* Canva-Style Clean Image Bounding Box */}
              {isEditingImageMode && !isDeleted && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedObject({ type: 'image', id: img.id, data: img })
                    setPropertiesOpen(true)
                  }}
                  onMouseDown={(e) =>
                    startDragItem(e, img.id, 'orig-image', img.x, img.y)
                  }
                  className={`absolute z-26 cursor-pointer rounded-xs transition-all group ${isSelected
                    ? 'ring-2 ring-brand-violet'
                    : 'hover:ring-1 hover:ring-brand-violet/60'
                    }`}
                  style={{
                    left: `${img.x}%`,
                    top: `${img.y}%`,
                    width: `${img.width}%`,
                    height: `${img.height}%`,
                  }}
                  title="Klik untuk memilih gambar, geser untuk pindahkan"
                >
                  {/* Canva-Style 4 Corner Resize Dots */}
                  {isSelected && (
                    <>
                      <div
                        className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border border-brand-violet rounded-full shadow-xs cursor-nw-resize hover:scale-125 transition-transform"
                        onMouseDown={(e) =>
                          startResizeImage(e, img.id, 'nw', img.x, img.y, img.width, img.height)
                        }
                        title="Ubah ukuran"
                      />
                      <div
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border border-brand-violet rounded-full shadow-xs cursor-ne-resize hover:scale-125 transition-transform"
                        onMouseDown={(e) =>
                          startResizeImage(e, img.id, 'ne', img.x, img.y, img.width, img.height)
                        }
                        title="Ubah ukuran"
                      />
                      <div
                        className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border border-brand-violet rounded-full shadow-xs cursor-sw-resize hover:scale-125 transition-transform"
                        onMouseDown={(e) =>
                          startResizeImage(e, img.id, 'sw', img.x, img.y, img.width, img.height)
                        }
                        title="Ubah ukuran"
                      />
                      <div
                        className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border border-brand-violet rounded-full shadow-xs cursor-se-resize hover:scale-125 transition-transform"
                        onMouseDown={(e) =>
                          startResizeImage(e, img.id, 'se', img.x, img.y, img.width, img.height)
                        }
                        title="Ubah ukuran"
                      />

                      {/* Floating Mini Action Bar for Selected Image */}
                      <div
                        className="absolute -top-8 left-0 flex items-center gap-1.5 bg-[#12141a]/95 backdrop-blur-sm border border-[#2b2e3d] px-2.5 py-1 rounded-lg shadow-xl text-[11px] z-40 select-none whitespace-nowrap"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => triggerImageReplace(e, img.id)}
                          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                        >
                          <ImageIcon className="w-3 h-3" />
                          Ganti Gambar
                        </button>
                        <div className="w-px h-3 bg-slate-700 mx-0.5" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const w = Math.max(5, img.width * 0.9)
                            const h = Math.max(3, img.height * 0.9)
                            updateOriginalImage(img.id, {
                              width: Math.round(w * 10) / 10,
                              height: Math.round(h * 10) / 10,
                              isModified: true,
                            })
                          }}
                          className="p-0.5 hover:text-cyan-400 text-slate-400 hover:bg-[#202534] rounded flex items-center"
                          title="Perkecil (-10%)"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const w = Math.min(95, img.width * 1.1)
                            const h = Math.min(95, img.height * 1.1)
                            updateOriginalImage(img.id, {
                              width: Math.round(w * 10) / 10,
                              height: Math.round(h * 10) / 10,
                              isModified: true,
                            })
                          }}
                          className="p-0.5 hover:text-cyan-400 text-slate-400 hover:bg-[#202534] rounded flex items-center"
                          title="Perbesar (+10%)"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <div className="w-px h-3 bg-slate-700 mx-0.5" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteOriginalImage(img.id)
                          }}
                          className="p-0.5 hover:text-rose-400 text-slate-400 hover:bg-[#202534] rounded"
                          title="Hapus gambar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}

        {/* 2. ORIGINAL PDF TEXT & OCR ELEMENTS (z-25, above images) */}
        {pageOriginalTexts.map((txt) => {
          const isDeleted = !!txt.isDeleted
          const isModified = !!txt.isModified
          const isSelected = selectedObject?.type === 'text' && selectedObject.id === txt.id
          const isEditingThis = inlineEditor.visible && inlineEditor.id === txt.id

          const origX = txt.origX ?? txt.x
          const origY = txt.origY ?? txt.y
          const origW = txt.origWidth ?? txt.width
          const origH = txt.origHeight ?? txt.height

          // Needs whiteout over original location if deleted, modified, or editing
          const needsWhiteout = isDeleted || isModified || isEditingThis

          return (
            <React.Fragment key={txt.id}>
              {/* Clean whiteout patch over original position matching exact sampled background */}
              {needsWhiteout && (
                <div
                  className="absolute pointer-events-none z-18"
                  style={{
                    left: `${origX}%`,
                    top: `${origY}%`,
                    width: `${origW}%`,
                    height: `${origH}%`,
                    backgroundColor: txt.backgroundColor || '#ffffff',
                  }}
                />
              )}

              {/* Interactive Canva Text Box */}
              {!isDeleted && !isEditingThis && isEditingTextMode && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedObject({ type: 'text', id: txt.id, data: txt })
                    setPropertiesOpen(true)
                  }}
                  onDoubleClick={(e) => handleDoubleClickOriginalText(e, txt)}
                  onMouseDown={(e) =>
                    startDragItem(e, txt.id, 'orig-text', txt.x, txt.y)
                  }
                  className={`absolute z-25 cursor-pointer rounded-xs select-none transition-all group ${isSelected
                    ? 'ring-2 ring-brand-violet'
                    : 'hover:ring-1 hover:ring-brand-violet/70'
                    }`}
                  style={{
                    left: `${txt.x}%`,
                    top: `${txt.y}%`,
                    width: isModified
                      ? `${Math.max(txt.width, origW, 2)}%`
                      : `${Math.max(txt.width, 1.5)}%`,
                    minHeight: isModified ? `${Math.max(txt.height, 1.2)}%` : undefined,
                    height: isModified ? undefined : `${Math.max(txt.height, 1.2)}%`,
                    backgroundColor: 'transparent',
                  }}
                  title="Double-click untuk edit teks, geser untuk pindahkan, tarik pegangan untuk ubah ukuran"
                >
                  {/* Living modified text content */}
                  {isModified && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: `${txt.fontSize * effectiveScale}px`,
                        color: txt.color || '#000000',
                        fontFamily: getCssFontFamily(txt.fontFamily),
                        lineHeight: txt.lineHeight
                          ? `${txt.lineHeight * effectiveScale}px`
                          : 1.35,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'normal',
                        overflowWrap: 'break-word',
                      }}
                    >
                      {getEffectiveRuns(txt).map((run, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontWeight: run.bold ? 700 : 400,
                            fontStyle: run.italic ? 'italic' : 'normal',
                            textDecoration: run.underline ? 'underline' : 'none',
                            color: run.color || undefined,
                          }}
                        >
                          {run.text}
                        </span>
                      ))}
                    </span>
                  )}

                  {/* Canva-Style Interactive Text Resize Handles */}
                  {isSelected && (
                    <>
                      {/* 4 Corner Dots: Scale Font Size ("ngebesarin / ngecilin tulisan") */}
                      <div
                        className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-brand-violet rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform z-35"
                        onMouseDown={(e) =>
                          startResizeText(e, txt.id, 'nw', txt.x, txt.y, Math.max(txt.width, origW), Math.max(txt.height, origH), txt.fontSize)
                        }
                        title="Tarik sudut untuk memperbesar / memperkecil ukuran tulisan"
                      />
                      <div
                        className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-brand-violet rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform z-35"
                        onMouseDown={(e) =>
                          startResizeText(e, txt.id, 'ne', txt.x, txt.y, Math.max(txt.width, origW), Math.max(txt.height, origH), txt.fontSize)
                        }
                        title="Tarik sudut untuk memperbesar / memperkecil ukuran tulisan"
                      />
                      <div
                        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-brand-violet rounded-full shadow-md cursor-nesw-resize hover:scale-125 transition-transform z-35"
                        onMouseDown={(e) =>
                          startResizeText(e, txt.id, 'sw', txt.x, txt.y, Math.max(txt.width, origW), Math.max(txt.height, origH), txt.fontSize)
                        }
                        title="Tarik sudut untuk memperbesar / memperkecil ukuran tulisan"
                      />
                      <div
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-brand-violet rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform z-35"
                        onMouseDown={(e) =>
                          startResizeText(e, txt.id, 'se', txt.x, txt.y, Math.max(txt.width, origW), Math.max(txt.height, origH), txt.fontSize)
                        }
                        title="Tarik sudut untuk memperbesar / memperkecil ukuran tulisan"
                      />

                      {/* 2 Side Pill Handles: Adjust Width so text fits on 1 single line ("sejajar 1 baris") */}
                      <div
                        className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-4 bg-brand-violet border border-white rounded-full shadow-md cursor-ew-resize hover:scale-125 transition-transform z-35"
                        onMouseDown={(e) =>
                          startResizeText(e, txt.id, 'e', txt.x, txt.y, Math.max(txt.width, origW), Math.max(txt.height, origH), txt.fontSize)
                        }
                        title="Tarik ke samping agar teks sejajar (1 baris)"
                      />
                      <div
                        className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-4 bg-brand-violet border border-white rounded-full shadow-md cursor-ew-resize hover:scale-125 transition-transform z-35"
                        onMouseDown={(e) =>
                          startResizeText(e, txt.id, 'w', txt.x, txt.y, Math.max(txt.width, origW), Math.max(txt.height, origH), txt.fontSize)
                        }
                        title="Tarik ke samping agar teks sejajar (1 baris)"
                      />

                      {/* Floating Mini Action Bar for Selected Text */}
                      <div
                        className="absolute -top-8 left-0 flex items-center gap-1.5 bg-[#12141a]/95 backdrop-blur-sm border border-[#2b2e3d] px-2 py-1 rounded-lg shadow-xl text-[11px] z-40 select-none whitespace-nowrap"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => handleDoubleClickOriginalText(e, txt)}
                          className="text-brand-purple hover:text-purple-300 flex items-center gap-1 font-medium px-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit Teks
                        </button>
                        <div className="w-px h-3 bg-slate-700 mx-0.5" />
                        {/* Quick Font Size - */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateOriginalText(txt.id, {
                              fontSize: Math.max(6, Math.round(txt.fontSize - 1)),
                              isModified: true,
                            })
                          }}
                          className="p-0.5 hover:text-cyan-400 text-slate-400 hover:bg-[#202534] rounded flex items-center"
                          title="Perkecil huruf (-1pt)"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-slate-300 font-mono font-medium px-0.5">
                          {Math.round(txt.fontSize)}pt
                        </span>
                        {/* Quick Font Size + */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateOriginalText(txt.id, {
                              fontSize: Math.min(120, Math.round(txt.fontSize + 1)),
                              isModified: true,
                            })
                          }}
                          className="p-0.5 hover:text-cyan-400 text-slate-400 hover:bg-[#202534] rounded flex items-center"
                          title="Perbesar huruf (+1pt)"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <div className="w-px h-3 bg-slate-700 mx-0.5" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteOriginalText(txt.id)
                          }}
                          className="p-0.5 hover:text-rose-400 text-slate-400 hover:bg-[#202534] rounded"
                          title="Hapus teks ini"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}

        {/* 3. AUTO-DETECTED SIGNATURE SPOTS */}
        {showDetectedSpots &&
          unfilledSpots.map((spot) => (
            <div
              key={spot.id}
              onClick={(e) => handleSpotClick(e, spot)}
              className="absolute z-26 cursor-pointer group border-2 border-dashed border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-all flex flex-col items-center justify-start p-0.5 shadow-md shadow-cyan-500/10 overflow-hidden"
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                width: `${spot.width}%`,
                height: `${spot.height}%`,
              }}
              title={`Klik untuk memasang tanda tangan di: ${spot.label}`}
            >
              <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-slate-950/85 px-2 py-0.5 rounded-full border border-cyan-500/40 shadow-sm truncate max-w-full">
                <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">{spot.label}</span>
              </div>
              <span className="text-[10px] text-cyan-200 mt-0.5 font-medium hidden group-hover:block bg-slate-900/90 px-1.5 py-0.2 rounded">
                {savedSignature ? '⚡ Klik untuk Pasang TTD' : '✍️ Buat TTD di Sini'}
              </span>
            </div>
          ))}

        {/* BLANK PAGE QUICK-START OVERLAY */}
        {isBlankPage && !inlineEditor.visible && !commentDraft.visible && (
          <div
            className="absolute inset-x-0 top-10 flex justify-center z-25 pointer-events-none"
          >
            <div
              className="pointer-events-auto bg-[#14161f]/95 backdrop-blur-md border border-[#2a2e40] rounded-2xl px-4 py-3 shadow-2xl flex flex-col items-center gap-2.5 max-w-md"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <span className="text-[11px] font-medium text-slate-300">
                Halaman Kosong (Hal {currentPage}) — Pilih aksi cepat atau alat di toolbar:
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('text')
                    setInlineEditor({
                      visible: true,
                      isOriginalText: false,
                      x: 12,
                      y: 18,
                      text: '',
                      isWhiteout: false,
                      fontSize,
                      color: color || '#0f172a',
                      fontFamily: 'Helvetica',
                    })
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <TypeIcon className="w-3.5 h-3.5" />
                  Tambah Teks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('comment')
                    setCommentDraft({
                      visible: true,
                      x: 68,
                      y: 18,
                      text: '',
                      author: 'Reviewer',
                      color: '#f59e0b',
                    })
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Tambah Comment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTool('image')
                    setActiveModal('image')
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Sisipkan Gambar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. USER ANNOTATIONS, COMMENTS, SIGNATURES, AND TRUE REDACTIONS OVERLAY */}
        <div className="absolute inset-0 pointer-events-none z-30">
          {pageAnnotations.map((ann) => {
            const isEditingThis = inlineEditor.visible && inlineEditor.id === ann.id
            if (isEditingThis) return null

            const isSelected = selectedAnnId === ann.id
            const isCommentOpen = ann.type === 'comment' && openCommentId === ann.id

            return (
              <div
                key={ann.id}
                onMouseDown={(e) =>
                  startDragItem(e, ann.id, 'annotation', ann.x, ann.y)
                }
                onDoubleClick={(e) => {
                  if (ann.type === 'text') {
                    handleDoubleClickAnnotationText(e, ann)
                  }
                }}
                className={`absolute pointer-events-auto group cursor-grab active:cursor-grabbing select-none rounded ${
                  ann.type === 'comment'
                    ? ''
                    : isSelected
                      ? 'ring-2 ring-brand-violet ring-dashed'
                      : 'hover:ring-1 hover:ring-brand-violet hover:ring-dashed'
                }`}
                style={{
                  left: `${ann.x}%`,
                  top: `${ann.y}%`,
                  width: ann.width && ann.type !== 'comment' ? `${ann.width}%` : undefined,
                  height: ann.height && ann.type !== 'comment' ? `${ann.height}%` : undefined,
                  zIndex: isCommentOpen ? 45 : undefined,
                  touchAction: 'none',
                }}
              >
                {/* Sticky-Note Comment Pin & Expandable Bubble */}
                {ann.type === 'comment' && (
                  <div className="relative">
                    <div
                      className={`w-7 h-7 rounded-full shadow-lg flex items-center justify-center border-2 transition-transform hover:scale-110 ${
                        isSelected ? 'ring-2 ring-white scale-110' : ''
                      } ${ann.resolved ? 'opacity-65' : ''}`}
                      style={{
                        backgroundColor: ann.color || '#f59e0b',
                        borderColor: '#ffffff',
                      }}
                      title={`${ann.author || 'Reviewer'}: ${ann.text || ''} (Klik untuk buka/tutup, geser untuk pindah)`}
                    >
                      {ann.resolved ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>

                    {isCommentOpen && (
                      <div
                        className={`absolute top-0 w-64 bg-[#14161f] border border-[#2d3246] rounded-xl shadow-2xl p-3 z-50 text-xs text-slate-200 cursor-default ${
                          ann.x > 55 ? 'right-8' : 'left-8'
                        }`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#242838]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: ann.color || '#f59e0b' }}
                            />
                            <span className="font-semibold text-white truncate">
                              {ann.author || 'Reviewer'}
                            </span>
                            {ann.resolved && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-medium">
                                Selesai
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setOpenCommentId(null)}
                            className="p-0.5 text-slate-400 hover:text-white rounded"
                            title="Tutup"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <textarea
                          rows={3}
                          value={ann.text || ''}
                          onChange={(e) => updateAnnotation(ann.id, { text: e.target.value })}
                          className="w-full bg-[#1a1d2a] border border-[#2b3044] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                          placeholder="Tulis komentar..."
                        />

                        <div className="flex items-center justify-between mt-2 pt-1.5">
                          <button
                            onClick={() => updateAnnotation(ann.id, { resolved: !ann.resolved })}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                              ann.resolved
                                ? 'bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/40'
                                : 'bg-[#202434] text-slate-300 hover:text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {ann.resolved ? 'Buka lagi' : 'Selesai'}
                          </button>
                          <button
                            onClick={() => {
                              setOpenCommentId(null)
                              removeAnnotation(ann.id)
                            }}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-rose-400 hover:bg-rose-950/50 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* True Redaction Blackout Box */}
                {ann.type === 'redact' && (
                  <div
                    className="w-full h-full bg-black rounded-xs shadow-md border border-neutral-900 flex items-center justify-center relative overflow-hidden"
                    title="True PDF Redaction: Konten pada area ini akan dihapus permanen dari file PDF hasil ekspor"
                  >
                    <div className="text-[9px] font-mono tracking-widest text-neutral-400 uppercase select-none opacity-80">
                      REDACTED
                    </div>
                  </div>
                )}

                {/* Highlight */}
                {ann.type === 'highlight' && (
                  <div
                    className="w-full h-full rounded-sm transition-all"
                    style={{
                      backgroundColor: ann.color || '#fbbf24',
                      opacity: ann.opacity ?? 0.35,
                    }}
                  />
                )}

                {/* Text / Whiteout Replace */}
                {ann.type === 'text' && (
                  <div
                    className={`whitespace-pre-wrap font-sans px-1 py-0.5 leading-normal rounded-none transition-colors ${ann.backgroundColor ? 'bg-white' : ''
                      }`}
                    style={{
                      color: ann.color || '#0f172a',
                      fontSize: `${(ann.fontSize || 14) * effectiveScale}px`,
                      fontFamily: getCssFontFamily(ann.fontFamily),
                      backgroundColor: ann.backgroundColor || undefined,
                    }}
                    title="Klik dan tahan untuk geser, double-click untuk edit teks"
                  >
                    {getEffectiveRuns(ann).map((run, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontWeight: run.bold ? 700 : 400,
                          fontStyle: run.italic ? 'italic' : 'normal',
                          textDecoration: run.underline ? 'underline' : 'none',
                          color: run.color || undefined,
                        }}
                      >
                        {run.text}
                      </span>
                    ))}
                  </div>
                )}

                {/* Shapes: Rectangle, Circle, Line, Arrow */}
                {ann.type === 'shape' && ann.shapeType === 'rect' && (
                  <div
                    className="w-full h-full border-2 rounded-sm"
                    style={{
                      borderColor: ann.color || '#8b5cf6',
                      borderWidth: `${(ann.strokeWidth || 2) * effectiveScale}px`,
                    }}
                  />
                )}
                {ann.type === 'shape' && ann.shapeType === 'circle' && (
                  <div
                    className="w-full h-full border-2 rounded-full"
                    style={{
                      borderColor: ann.color || '#8b5cf6',
                      borderWidth: `${(ann.strokeWidth || 2) * effectiveScale}px`,
                    }}
                  />
                )}
                {ann.type === 'shape' && (ann.shapeType === 'line' || ann.shapeType === 'arrow') && (
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line
                      x1={0}
                      y1={0}
                      x2={100}
                      y2={100}
                      stroke={ann.color || '#8b5cf6'}
                      strokeWidth={Math.max(2, (ann.strokeWidth || 2) * 2)}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                )}

                {/* Signature / Image */}
                {(ann.type === 'signature' || ann.type === 'image') && ann.dataUrl && (
                  <div
                    className="w-full h-full relative"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    <img
                      src={ann.dataUrl}
                      alt={ann.type}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />
                  </div>
                )}

                {/* Canva Corner Resize Dot on Selected Box Annotations */}
                {isSelected &&
                  (ann.type === 'image' ||
                    ann.type === 'signature' ||
                    ann.type === 'highlight' ||
                    ann.type === 'shape' ||
                    ann.type === 'redact') && (
                    <div
                      onMouseDown={(e) => startResizeAnnotationBox(e, ann)}
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-brand-violet rounded-full shadow-md cursor-nwse-resize hover:scale-125 transition-transform z-40"
                      title="Tarik untuk mengubah ukuran"
                    />
                  )}

                {/* Floating Action Bar for Dragging, Resizing, Editing & Deleting */}
                {ann.type !== 'comment' && (
                  <div
                    className="absolute -top-7 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#12141a]/95 backdrop-blur-sm border border-[#2b2e3d] px-2 py-0.5 rounded-lg shadow-xl text-[11px] z-40 select-none whitespace-nowrap"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <span className="text-slate-300 flex items-center gap-1 font-medium cursor-grab active:cursor-grabbing">
                      <Move className="w-3 h-3 text-cyan-400" />
                      Geser
                    </span>

                    {ann.type === 'text' && (
                      <>
                        <div className="w-px h-3 bg-slate-700 mx-0.5" />
                        <button
                          onClick={(e) => handleDoubleClickAnnotationText(e, ann)}
                          className="text-brand-purple hover:text-purple-300 flex items-center gap-1 font-medium px-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateAnnotation(ann.id, {
                              fontSize: Math.max(8, (ann.fontSize || 14) - 2),
                            })
                          }}
                          className="p-0.5 hover:text-white text-slate-400 hover:bg-[#202534] rounded"
                          title="Kecilkan huruf"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateAnnotation(ann.id, {
                              fontSize: Math.min(72, (ann.fontSize || 14) + 2),
                            })
                          }}
                          className="p-0.5 hover:text-white text-slate-400 hover:bg-[#202534] rounded"
                          title="Besarkan huruf"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </>
                    )}

                    {(ann.type === 'signature' || ann.type === 'image' || ann.type === 'redact') && (
                      <>
                        <div className="w-px h-3 bg-slate-700 mx-0.5" />
                        <button
                          onClick={(e) => handleResizeAnnotation(e, ann, -1)}
                          className="p-0.5 hover:text-white text-slate-400 hover:bg-[#202534] rounded"
                          title="Kecilkan ukuran"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleResizeAnnotation(e, ann, 1)}
                          className="p-0.5 hover:text-white text-slate-400 hover:bg-[#202534] rounded"
                          title="Perbesar ukuran"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </>
                    )}

                    <div className="w-px h-3 bg-slate-700 mx-0.5" />

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAnnotation(ann.id)
                      }}
                      className="p-0.5 hover:text-rose-400 text-slate-400 hover:bg-[#202534] rounded"
                      title="Hapus"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 5. LIVE WATERMARK PREVIEW */}
        {watermarkOptions && watermarkOptions.text && (
          <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center overflow-hidden">
            <div
              className="font-bold tracking-widest select-none whitespace-nowrap"
              style={{
                color: watermarkOptions.color || '#dc2626',
                opacity: watermarkOptions.opacity || 0.25,
                fontSize: `${(watermarkOptions.fontSize || 48) * effectiveScale}px`,
                transform: `rotate(${watermarkOptions.rotation || -45}deg)`,
              }}
            >
              {watermarkOptions.text}
            </div>
          </div>
        )}

        {/* 6. LIVE PAGE NUMBER PREVIEW */}
        {pageNumberOptions && (
          <div
            className="absolute pointer-events-none z-20 text-slate-600 font-mono select-none px-6"
            style={{
              fontSize: `${(pageNumberOptions.fontSize || 10) * effectiveScale}px`,
              ...(pageNumberOptions.position.includes('bottom')
                ? { bottom: '15px' }
                : { top: '15px' }),
              ...(pageNumberOptions.position.includes('center')
                ? { left: '50%', transform: 'translateX(-50%)' }
                : pageNumberOptions.position.includes('right')
                  ? { right: '20px' }
                  : { left: '20px' }),
            }}
          >
            {pageNumberOptions.format === '1' && currentPage}
            {pageNumberOptions.format === '1 / N' && `${currentPage} / ${pages.length}`}
            {pageNumberOptions.format === 'Page 1 of N' &&
              `Page ${currentPage} of ${pages.length}`}
            {pageNumberOptions.format === '- 1 -' && `- ${currentPage} -`}
          </div>
        )}

        {/* Live Drawing Box Preview for Highlight / Shapes / Redact */}
        {isDrawing && currentBox && (
          <div
            className={`absolute pointer-events-none border-2 ${activeTool === 'highlight'
              ? 'bg-yellow-400/30 border-yellow-500 rounded-sm'
              : activeTool === 'redact'
                ? 'bg-black/80 border-red-500 rounded-sm'
                : activeTool === 'circle'
                  ? 'border-brand-violet bg-brand-violet/10 rounded-full'
                  : 'border-brand-violet bg-brand-violet/10 rounded-sm'
              }`}
            style={{
              left: `${Math.min(currentBox.x, currentBox.x + currentBox.w)}%`,
              top: `${Math.min(currentBox.y, currentBox.y + currentBox.h)}%`,
              width: `${Math.abs(currentBox.w)}%`,
              height: `${Math.abs(currentBox.h)}%`,
            }}
          />
        )}

        {/* Comment Composer Popover */}
        {commentDraft.visible && (
          <div
            className="absolute z-50 w-64 bg-[#14161f] border border-amber-500/60 rounded-xl shadow-2xl p-3 text-xs text-slate-200"
            style={{
              left: `${commentDraft.x}%`,
              top: `${commentDraft.y}%`,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Tambah Comment
              </span>
              <div className="flex items-center gap-1">
                {['#f59e0b', '#3b82f6', '#10b981', '#ef4444'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCommentDraft((prev) => ({ ...prev, color: c }))}
                    className={`w-3.5 h-3.5 rounded-full ${
                      commentDraft.color === c ? 'ring-2 ring-white scale-110' : 'opacity-75'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <textarea
              ref={commentTextareaRef}
              autoFocus
              rows={3}
              value={commentDraft.text}
              onChange={(e) => setCommentDraft((prev) => ({ ...prev, text: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !commentDraft.text.includes('\n'))) {
                  e.preventDefault()
                  commitCommentDraft()
                }
                if (e.key === 'Escape') {
                  setCommentDraft((prev) => ({ ...prev, visible: false, text: '' }))
                  setActiveTool('select')
                }
              }}
              placeholder="Tulis catatan komentar di sini..."
              className="w-full bg-[#1a1d2a] border border-[#2c3145] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
            />

            <div className="flex items-center justify-end gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setCommentDraft((prev) => ({ ...prev, visible: false, text: '' }))
                  setActiveTool('select')
                }}
                className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#202434] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={commitCommentDraft}
                disabled={!commentDraft.text.trim()}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-40 transition-colors"
              >
                Simpan Comment
              </button>
            </div>
          </div>
        )}

        {/* Modern In-Place Text Editor (Canva Style) */}
        {inlineEditor.visible && (
          <div
            className="absolute z-50"
            style={{
              left: `${inlineEditor.x}%`,
              top: `${inlineEditor.y}%`,
              width: inlineEditor.width ? `${inlineEditor.width + 1}%` : 'auto',
              minWidth: '140px',
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const editingOriginalTxt = inlineEditor.isOriginalText
                ? pageOriginalTexts.find((t) => t.id === inlineEditor.id)
                : null
              const editorBg =
                editingOriginalTxt?.backgroundColor ||
                (inlineEditor.isWhiteout ? '#ffffff' : 'rgba(255,255,255,0.92)')
              return (
                <div
                  className="rounded-xs border-2 border-brand-violet px-1 py-0.5 shadow-lg"
                  style={{ backgroundColor: editorBg }}
                >
                  <div
                    ref={richEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    data-placeholder="Ketik teks di sini..."
                    onInput={() => syncInlineEditorFromDom()}
                    onMouseUp={() => refreshInlineFormatState()}
                    onKeyUp={() => refreshInlineFormatState()}
                    onPaste={(e) => {
                      e.preventDefault()
                      const plain = e.clipboardData.getData('text/plain')
                      document.execCommand('insertText', false, plain)
                      syncInlineEditorFromDom()
                    }}
                    onBlur={(e) => {
                      // Don't close if focus moved inside PropertiesPanel or inline toolbar
                      const next = e.relatedTarget as HTMLElement | null
                      if (next && next.closest('[data-rich-format-control="true"]')) {
                        return
                      }
                      if (inlineEditor.isOriginalText) {
                        commitInlineText()
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                        e.preventDefault()
                        e.stopPropagation()
                        applyInlineFormat('bold')
                        return
                      }
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                        e.preventDefault()
                        e.stopPropagation()
                        applyInlineFormat('italic')
                        return
                      }
                      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
                        e.preventDefault()
                        e.stopPropagation()
                        applyInlineFormat('underline')
                        return
                      }
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        (e.ctrlKey || e.metaKey || !inlineEditor.text.includes('\n'))
                      ) {
                        e.preventDefault()
                        commitInlineText()
                        return
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelInlineText()
                      }
                    }}
                    className="bg-transparent focus:outline-none w-full block leading-normal p-0 m-0 min-h-[1.2em] cursor-text"
                    style={{
                      fontSize: `${inlineEditor.fontSize * effectiveScale}px`,
                      color: inlineEditor.color || '#000000',
                      fontFamily: getCssFontFamily(inlineEditor.fontFamily),
                      lineHeight: inlineEditor.lineHeight
                        ? `${inlineEditor.lineHeight * effectiveScale}px`
                        : 1.35,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'normal',
                      overflowWrap: 'break-word',
                    }}
                  />
                </div>
              )
            })()}

            <div
              data-rich-format-control="true"
              className="mt-1 flex items-center gap-1 bg-[#12141a]/95 border border-[#2b2e3d] p-1 rounded-lg shadow-xl text-xs select-none"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                data-rich-format-control="true"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  applyInlineFormat('bold')
                }}
                className={`p-1 rounded transition-colors ${inlineFormatState.bold
                  ? 'bg-brand-violet text-white'
                  : 'text-slate-300 hover:text-white hover:bg-[#202432]'
                  }`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-rich-format-control="true"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  applyInlineFormat('italic')
                }}
                className={`p-1 rounded transition-colors ${inlineFormatState.italic
                  ? 'bg-brand-violet text-white'
                  : 'text-slate-300 hover:text-white hover:bg-[#202432]'
                  }`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-rich-format-control="true"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  applyInlineFormat('underline')
                }}
                className={`p-1 rounded transition-colors ${inlineFormatState.underline
                  ? 'bg-brand-violet text-white'
                  : 'text-slate-300 hover:text-white hover:bg-[#202432]'
                  }`}
                title="Underline (Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>

              {!inlineEditor.isOriginalText && (
                <>
                  <div className="w-px h-3 bg-slate-700 mx-0.5" />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setInlineEditor({
                        ...inlineEditor,
                        isWhiteout: !inlineEditor.isWhiteout,
                      })
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${inlineEditor.isWhiteout
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-[#202432]'
                      }`}
                    title="Whiteout background to replace original text"
                  >
                    <Eraser className="w-3 h-3" />
                    Whiteout BG
                  </button>
                </>
              )}

              <div className="w-px h-3 bg-slate-700 mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={cancelInlineText}
                className="p-1 text-slate-400 hover:text-white hover:bg-[#202432] rounded transition-colors"
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={commitInlineText}
                className="px-2.5 py-0.5 bg-brand-violet hover:bg-purple-600 text-white rounded text-[11px] font-medium flex items-center gap-1 shadow-sm transition-colors active:scale-95"
                title="Done (Enter)"
              >
                <Check className="w-3.5 h-3.5" />
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Navigation Status Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#12141a]/95 backdrop-blur-md border border-[#232736] px-4 py-2 rounded-full shadow-2xl flex items-center gap-4 text-xs select-none z-40">
        <div className="flex items-center gap-1 text-slate-300">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className={`p-1 rounded-full transition-colors ${currentPage <= 1
              ? 'text-slate-600 cursor-not-allowed'
              : 'hover:bg-[#252838] text-slate-300'
              }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="font-medium px-2 text-slate-200">
            Page {currentPage} of {pages.length}
          </span>

          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= pages.length}
            className={`p-1 rounded-full transition-colors ${currentPage >= pages.length
              ? 'text-slate-600 cursor-not-allowed'
              : 'hover:bg-[#252838] text-slate-300'
              }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-4 bg-[#232736]" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(zoom - 0.15)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Zoom Out (Ctrl + -)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="font-mono text-slate-300 min-w-10 text-center hover:text-white hover:bg-[#252838] px-1.5 py-0.5 rounded transition-colors cursor-pointer text-xs"
            title="Reset Zoom 100% (Ctrl + 0)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom(zoom + 0.15)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Zoom In (Ctrl + + / Pinch Touchpad)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
