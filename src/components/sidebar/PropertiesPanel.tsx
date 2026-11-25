import React from 'react'
import {
  X,
  Type,
  Image as ImageIcon,
  Square,
  FileText,
  Trash2,
  RotateCw,
  Copy,
  Crop,
  Plus,
  Minus,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Bold,
  Italic,
  Underline,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PdfTextElement, PdfImageElement, AnnotationItem } from '@/types'
import { applyRunStyleToAll, getEffectiveRuns } from '@/core/pdf/rich-text'
import { calculateFittedDimensions } from '@/utils/image-utils'

export const PropertiesPanel: React.FC = () => {
  const {
    isPropertiesOpen,
    setPropertiesOpen,
    selectedObject,
    setSelectedObject,
    currentPage,
    pages,
    originalImages,
    updateOriginalText,
    deleteOriginalText,
    updateOriginalImage,
    deleteOriginalImage,
    updateAnnotation,
    removeAnnotation,
    duplicateCurrentPage,
    rotateCurrentPage,
    setActiveModal,
  } = usePdfStore()

  if (!isPropertiesOpen) return null

  const pageInfo = pages.find((p) => p.pageNumber === currentPage)

  // Color options
  const colorPalette = [
    '#0f172a',
    '#1e40af',
    '#7c3aed',
    '#dc2626',
    '#059669',
    '#d97706',
    '#475569',
    '#ffffff',
  ]

  const handleImageReplace = (e: React.ChangeEvent<HTMLInputElement>, imgId: string, isOrig = true) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (dataUrl) {
        const targetImg = isOrig ? originalImages.find((im) => im.id === imgId) : undefined
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

          if (isOrig) {
            updateOriginalImage(imgId, {
              replacementDataUrl: finalPngUrl,
              width: dims?.width ?? targetImg?.width,
              height: dims?.height ?? targetImg?.height,
              isDeleted: false,
              isModified: true,
            })
          } else {
            updateAnnotation(imgId, { dataUrl: finalPngUrl })
          }
        }
        imgObj.src = dataUrl
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <aside className="absolute right-0 top-0 bottom-0 w-72 bg-[#12141c]/95 backdrop-blur-md border-l border-[#222532] flex flex-col h-full text-slate-200 select-none z-30 shadow-2xl">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-[#202330] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedObject?.type === 'text' && <Type className="w-4 h-4 text-brand-violet" />}
          {selectedObject?.type === 'image' && <ImageIcon className="w-4 h-4 text-cyan-400" />}
          {selectedObject?.type === 'annotation' && selectedObject.data?.type === 'comment' && (
            <MessageSquare className="w-4 h-4 text-amber-400" />
          )}
          {selectedObject?.type === 'annotation' && selectedObject.data?.type !== 'comment' && (
            <Square className="w-4 h-4 text-yellow-400" />
          )}
          {!selectedObject && <FileText className="w-4 h-4 text-blue-400" />}

          <h3 className="font-semibold text-xs tracking-wider uppercase text-white">
            {selectedObject?.type === 'text' && 'Edit Text'}
            {selectedObject?.type === 'image' && 'Edit Image'}
            {selectedObject?.type === 'annotation' && selectedObject.data?.type === 'comment' && 'Comment Note'}
            {selectedObject?.type === 'annotation' && selectedObject.data?.type !== 'comment' && 'Edit Annotation'}
            {!selectedObject && 'Page Properties'}
          </h3>
        </div>

        <button
          onClick={() => {
            setPropertiesOpen(false)
            setSelectedObject(null)
          }}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1e212d] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* 1. TEXT PROPERTIES */}
        {selectedObject?.type === 'text' && (
          <div className="space-y-4">
            {(() => {
              const textObj = selectedObject.data as PdfTextElement | AnnotationItem
              const isOrig = 'originalText' in textObj

              return (
                <>
                  {/* Text Content Area */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                      Text Content
                    </label>
                    <textarea
                      rows={3}
                      value={textObj.text || ''}
                      onChange={(e) => {
                        const newText = e.target.value
                        if (isOrig) {
                          updateOriginalText(textObj.id, { text: newText })
                        } else {
                          updateAnnotation(textObj.id, { text: newText })
                        }
                      }}
                      className="w-full bg-[#181b26] border border-[#272b3c] rounded-xl p-2.5 text-white font-sans focus:outline-none focus:border-brand-violet resize-none leading-relaxed"
                    />
                  </div>

                  {/* Font Family & Size */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Font Family
                      </label>
                      <select
                        value={textObj.fontFamily || 'Helvetica'}
                        onChange={(e) => {
                          const ff = e.target.value
                          if (isOrig) {
                            updateOriginalText(textObj.id, { fontFamily: ff })
                          } else {
                            updateAnnotation(textObj.id, { fontFamily: ff })
                          }
                        }}
                        className="w-full bg-[#181b26] border border-[#272b3c] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                      >
                        <option value="Helvetica">Helvetica (Sans-Serif)</option>
                        <option value="Helvetica-Bold">Helvetica Bold</option>
                        <option value="TimesRoman">Times New Roman</option>
                        <option value="Times-Roman-Bold">Times New Roman Bold</option>
                        <option value="Courier">Courier (Monospace)</option>
                        <option value="Courier-Bold">Courier Bold</option>
                        <option value="DejaVuSans">DejaVu Sans</option>
                        <option value="DejaVuSans-Bold">DejaVu Sans Bold</option>
                        <option value="Lato">Lato</option>
                        <option value="Lato-Bold">Lato Bold</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Font Size
                      </label>
                      <div className="flex items-center bg-[#181b26] border border-[#272b3c] rounded-lg p-0.5">
                        <button
                          onClick={() => {
                            const newSize = Math.max(6, Math.round(((textObj.fontSize || 14) - 1) * 10) / 10)
                            if (isOrig) updateOriginalText(textObj.id, { fontSize: newSize })
                            else updateAnnotation(textObj.id, { fontSize: newSize })
                          }}
                          className="p-1 hover:text-white text-slate-400"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="flex-1 text-center font-mono text-white text-xs">
                          {Math.round((textObj.fontSize || 14) * 10) / 10}px
                        </span>
                        <button
                          onClick={() => {
                            const newSize = Math.min(96, Math.round(((textObj.fontSize || 14) + 1) * 10) / 10)
                            if (isOrig) updateOriginalText(textObj.id, { fontSize: newSize })
                            else updateAnnotation(textObj.id, { fontSize: newSize })
                          }}
                          className="p-1 hover:text-white text-slate-400"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Font Style Toggles (Bold, Italic, Underline) */}
                  <div className="flex items-center gap-1.5" data-rich-format-control="true">
                    {(() => {
                      const runs = getEffectiveRuns(textObj)
                      const isInlineActive = () =>
                        Boolean(document.querySelector('[contenteditable="true"][role="textbox"]'))
                      const allBold =
                        runs.length > 0
                          ? runs.every((r) => r.bold)
                          : (textObj as any).fontWeight === 700 ||
                            textObj.fontFamily?.includes('Bold')
                      const allItalic =
                        runs.length > 0
                          ? runs.every((r) => r.italic)
                          : (textObj as any).fontStyle === 'italic' ||
                            textObj.fontFamily?.includes('Italic')
                      const allUnderline =
                        runs.length > 0
                          ? runs.every((r) => r.underline)
                          : Boolean((textObj as any).underline)

                      return (
                        <>
                          <button
                            type="button"
                            data-rich-format-control="true"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              if (isInlineActive()) {
                                window.dispatchEvent(
                                  new CustomEvent('veldora:format-inline', {
                                    detail: { command: 'bold' },
                                  })
                                )
                                return
                              }
                              const newBold = !allBold
                              const nextRuns = applyRunStyleToAll(runs, { bold: newBold })
                              const currentFamily = textObj.fontFamily || 'Helvetica'
                              let newFamily = currentFamily
                              if (newBold && !newFamily.includes('Bold')) {
                                newFamily = `${newFamily}-Bold`
                              } else if (!newBold && newFamily.includes('-Bold')) {
                                newFamily = newFamily.replace('-Bold', '')
                              }
                              if (isOrig) {
                                updateOriginalText(textObj.id, {
                                  runs: nextRuns,
                                  fontFamily: newFamily,
                                  fontWeight: newBold ? 700 : 400,
                                })
                              } else {
                                updateAnnotation(textObj.id, {
                                  runs: nextRuns,
                                  fontFamily: newFamily,
                                  fontWeight: newBold ? 700 : 400,
                                })
                              }
                            }}
                            title="Bold (Ctrl+B)"
                            className={`flex-1 py-1.5 px-2 rounded-lg border font-bold flex items-center justify-center gap-1 text-xs transition-colors ${allBold
                              ? 'bg-brand-violet border-brand-violet text-white'
                              : 'bg-[#181b26] border-[#272b3c] text-slate-400 hover:text-white'
                              }`}
                          >
                            <Bold className="w-3.5 h-3.5" />
                            B
                          </button>

                          <button
                            type="button"
                            data-rich-format-control="true"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              if (isInlineActive()) {
                                window.dispatchEvent(
                                  new CustomEvent('veldora:format-inline', {
                                    detail: { command: 'italic' },
                                  })
                                )
                                return
                              }
                              const newItalic = !allItalic
                              const nextRuns = applyRunStyleToAll(runs, { italic: newItalic })
                              if (isOrig) {
                                updateOriginalText(textObj.id, {
                                  runs: nextRuns,
                                  fontStyle: newItalic ? 'italic' : 'normal',
                                })
                              } else {
                                updateAnnotation(textObj.id, {
                                  runs: nextRuns,
                                  fontStyle: newItalic ? 'italic' : 'normal',
                                })
                              }
                            }}
                            title="Italic (Ctrl+I)"
                            className={`flex-1 py-1.5 px-2 rounded-lg border italic flex items-center justify-center gap-1 text-xs transition-colors ${allItalic
                              ? 'bg-brand-violet border-brand-violet text-white'
                              : 'bg-[#181b26] border-[#272b3c] text-slate-400 hover:text-white'
                              }`}
                          >
                            <Italic className="w-3.5 h-3.5" />
                            I
                          </button>

                          <button
                            type="button"
                            data-rich-format-control="true"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              if (isInlineActive()) {
                                window.dispatchEvent(
                                  new CustomEvent('veldora:format-inline', {
                                    detail: { command: 'underline' },
                                  })
                                )
                                return
                              }
                              const newUnderline = !allUnderline
                              const nextRuns = applyRunStyleToAll(runs, { underline: newUnderline })
                              if (isOrig) {
                                updateOriginalText(textObj.id, {
                                  runs: nextRuns,
                                  underline: newUnderline,
                                })
                              } else {
                                updateAnnotation(textObj.id, {
                                  runs: nextRuns,
                                  underline: newUnderline,
                                })
                              }
                            }}
                            title="Underline (Ctrl+U)"
                            className={`flex-1 py-1.5 px-2 rounded-lg border underline flex items-center justify-center gap-1 text-xs transition-colors ${allUnderline
                              ? 'bg-brand-violet border-brand-violet text-white'
                              : 'bg-[#181b26] border-[#272b3c] text-slate-400 hover:text-white'
                              }`}
                          >
                            <Underline className="w-3.5 h-3.5" />
                            U
                          </button>
                        </>
                      )
                    })()}
                  </div>

                  {/* Font Color with Native Color Picker & Hex Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-medium text-slate-400">
                        Font Color
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={
                            textObj.color?.startsWith('#') &&
                              textObj.color.length === 7
                              ? textObj.color
                              : '#000000'
                          }
                          onChange={(e) => {
                            const newCol = e.target.value
                            if (isOrig) updateOriginalText(textObj.id, { color: newCol })
                            else updateAnnotation(textObj.id, { color: newCol })
                          }}
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                          title="Pilih warna kustom"
                        />
                        <span className="font-mono text-[11px] text-slate-300">
                          {textObj.color || '#000000'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {colorPalette.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            if (isOrig) updateOriginalText(textObj.id, { color: c })
                            else updateAnnotation(textObj.id, { color: c })
                          }}
                          className={`w-5 h-5 rounded-full border border-slate-700 transition-transform ${textObj.color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                            }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Alignment */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                      Alignment
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-[#181b26] p-1 rounded-lg border border-[#272b3c]">
                      <button
                        onClick={() => {
                          if (isOrig) updateOriginalText(textObj.id, { alignment: 'left' })
                        }}
                        className={`py-1 flex items-center justify-center rounded ${(textObj as any).alignment === 'left' || !(textObj as any).alignment
                            ? 'bg-brand-violet text-white'
                            : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (isOrig) updateOriginalText(textObj.id, { alignment: 'center' })
                        }}
                        className={`py-1 flex items-center justify-center rounded ${(textObj as any).alignment === 'center'
                            ? 'bg-brand-violet text-white'
                            : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (isOrig) updateOriginalText(textObj.id, { alignment: 'right' })
                        }}
                        className={`py-1 flex items-center justify-center rounded ${(textObj as any).alignment === 'right'
                            ? 'bg-brand-violet text-white'
                            : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Perubahan Otomatis Tersimpan (Canva Style) */}
                  <div className="pt-1 text-[11px] text-emerald-400 flex items-center gap-1.5 justify-center">
                    <Sparkles className="w-3 h-3" />
                    <span>Perubahan otomatis tersimpan</span>
                  </div>

                  {/* Delete Text Button */}
                  <div className="pt-2 border-t border-[#222534]">
                    <button
                      onClick={() => {
                        if (isOrig) deleteOriginalText(textObj.id)
                        else removeAnnotation(textObj.id)
                      }}
                      className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Text
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* 2. IMAGE PROPERTIES */}
        {selectedObject?.type === 'image' && (
          <div className="space-y-4">
            {(() => {
              const imgObj = selectedObject.data as PdfImageElement | AnnotationItem
              const isOrig = 'imgId' in imgObj

              return (
                <>
                  <div className="bg-[#181b26] p-3 rounded-xl border border-[#272b3c] flex items-center gap-3">
                    <div className="w-12 h-12 bg-black/40 rounded-lg flex items-center justify-center overflow-hidden border border-slate-700">
                      {((imgObj as any).replacementDataUrl || imgObj.dataUrl) ? (
                        <img
                          src={(imgObj as any).replacementDataUrl || imgObj.dataUrl}
                          alt="Thumbnail"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-cyan-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">Embedded Image</p>
                      <p className="text-[10px] text-slate-400">
                        {imgObj.width?.toFixed(1)}% × {imgObj.height?.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Resize Controls */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-medium text-slate-400">
                      Scale Image
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const w = Math.max(5, (imgObj.width || 20) * 0.9)
                          const h = Math.max(3, (imgObj.height || 15) * 0.9)
                          if (isOrig)
                            updateOriginalImage(imgObj.id, {
                              width: Math.round(w * 10) / 10,
                              height: Math.round(h * 10) / 10,
                              isModified: true,
                            })
                          else updateAnnotation(imgObj.id, { width: w, height: h })
                        }}
                        className="py-1.5 bg-[#1a1d2b] hover:bg-[#25283a] text-slate-300 rounded-lg flex items-center justify-center gap-1 border border-slate-700/60"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        Smaller (-10%)
                      </button>
                      <button
                        onClick={() => {
                          const w = Math.min(95, (imgObj.width || 20) * 1.1)
                          const h = Math.min(95, (imgObj.height || 15) * 1.1)
                          if (isOrig)
                            updateOriginalImage(imgObj.id, {
                              width: Math.round(w * 10) / 10,
                              height: Math.round(h * 10) / 10,
                              isModified: true,
                            })
                          else updateAnnotation(imgObj.id, { width: w, height: h })
                        }}
                        className="py-1.5 bg-[#1a1d2b] hover:bg-[#25283a] text-slate-300 rounded-lg flex items-center justify-center gap-1 border border-slate-700/60"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Larger (+10%)
                      </button>
                    </div>
                  </div>

                  {/* Replace Image */}
                  <div>
                    <label className="w-full py-2 bg-[#1a1d2b] hover:bg-[#25283a] text-cyan-300 border border-cyan-800/40 rounded-xl flex items-center justify-center gap-2 font-medium cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      Replace Image...
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) => handleImageReplace(e, imgObj.id, isOrig)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Delete Image */}
                  <div className="pt-2 border-t border-[#222534]">
                    <button
                      onClick={() => {
                        if (isOrig) deleteOriginalImage(imgObj.id)
                        else removeAnnotation(imgObj.id)
                      }}
                      className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Image
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* 3. ANNOTATION / COMMENT PROPERTIES */}
        {selectedObject?.type === 'annotation' && (
          <div className="space-y-4">
            {(() => {
              const ann = selectedObject.data as AnnotationItem

              if (ann.type === 'comment') {
                return (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Author / Penulis
                      </label>
                      <input
                        type="text"
                        value={ann.author || 'Reviewer'}
                        onChange={(e) => updateAnnotation(ann.id, { author: e.target.value })}
                        className="w-full bg-[#181b26] border border-[#272b3c] rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                        Isi Komentar
                      </label>
                      <textarea
                        rows={4}
                        value={ann.text || ''}
                        onChange={(e) => updateAnnotation(ann.id, { text: e.target.value })}
                        placeholder="Tulis catatan atau komentar..."
                        className="w-full bg-[#181b26] border border-[#272b3c] rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                        Warna Pin Komentar
                      </label>
                      <div className="flex items-center gap-2">
                        {['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'].map((c) => (
                          <button
                            key={c}
                            onClick={() => updateAnnotation(ann.id, { color: c })}
                            className={`w-6 h-6 rounded-full border border-slate-700 transition-transform ${(ann.color || '#f59e0b') === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                              }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => updateAnnotation(ann.id, { resolved: !ann.resolved })}
                      className={`w-full py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-medium transition-colors ${ann.resolved
                          ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-900/60'
                          : 'bg-[#181b26] border-[#272b3c] text-slate-300 hover:text-white hover:bg-[#202434]'
                        }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {ann.resolved ? 'Komentar Selesai (Resolved)' : 'Tandai Selesai (Resolve)'}
                    </button>

                    <div className="pt-2 border-t border-[#222534]">
                      <button
                        onClick={() => removeAnnotation(ann.id)}
                        className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Komentar
                      </button>
                    </div>
                  </>
                )
              }

              return (
                <>
                  <div className="bg-[#181b26] p-3 rounded-xl border border-[#272b3c]">
                    <p className="font-semibold text-white capitalize">{ann.type}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Posisi: {ann.x.toFixed(1)}%, {ann.y.toFixed(1)}%
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                      Warna Objek
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {colorPalette.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateAnnotation(ann.id, { color: c })}
                          className={`w-5 h-5 rounded-full border border-slate-700 transition-transform ${ann.color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                            }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#222534]">
                    <button
                      onClick={() => removeAnnotation(ann.id)}
                      className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-xl flex items-center justify-center gap-1.5 font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus Objek
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* 4. DEFAULT: PAGE PROPERTIES */}
        {!selectedObject && (
          <div className="space-y-4">
            <div className="bg-[#181b26] p-3.5 rounded-xl border border-[#272b3c] space-y-1">
              <p className="font-semibold text-white">Page {currentPage} of {pages.length}</p>
              <p className="text-[11px] text-slate-400">
                Dimensions: {pageInfo?.width || 595} × {pageInfo?.height || 842} pt
              </p>
            </div>

            {/* Page Actions */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Page Operations
              </label>

              <button
                onClick={() => rotateCurrentPage(90)}
                className="w-full py-2 px-3 bg-[#181b26] hover:bg-[#202434] text-slate-200 rounded-xl flex items-center gap-2.5 transition-colors border border-slate-700/50"
              >
                <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                Rotate 90° Clockwise
              </button>

              <button
                onClick={duplicateCurrentPage}
                className="w-full py-2 px-3 bg-[#181b26] hover:bg-[#202434] text-slate-200 rounded-xl flex items-center gap-2.5 transition-colors border border-slate-700/50"
              >
                <Copy className="w-3.5 h-3.5 text-violet-400" />
                Duplicate Page
              </button>

              <button
                onClick={() => setActiveModal('crop')}
                className="w-full py-2 px-3 bg-[#181b26] hover:bg-[#202434] text-slate-200 rounded-xl flex items-center gap-2.5 transition-colors border border-slate-700/50"
              >
                <Crop className="w-3.5 h-3.5 text-emerald-400" />
                Crop Page...
              </button>

              <button
                onClick={() => setActiveModal('watermark')}
                className="w-full py-2 px-3 bg-[#181b26] hover:bg-[#202434] text-slate-200 rounded-xl flex items-center gap-2.5 transition-colors border border-slate-700/50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Watermark...
              </button>

              <button
                onClick={() => setActiveModal('page-number')}
                className="w-full py-2 px-3 bg-[#181b26] hover:bg-[#202434] text-slate-200 rounded-xl flex items-center gap-2.5 transition-colors border border-slate-700/50"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                Page Numbers...
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
