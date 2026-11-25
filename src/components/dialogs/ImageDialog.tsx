import React, { useEffect, useState } from 'react'
import { X, Image as ImageIcon, Upload, Check } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'

export const ImageDialog: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    currentPage,
    setCurrentPage,
    pages,
    addAnnotation,
    setActiveTool,
    setSelectedObject,
    setPropertiesOpen,
  } = usePdfStore()
  const [targetPage, setTargetPage] = useState(currentPage)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null)

  // Always sync targetPage to active currentPage whenever dialog opens
  useEffect(() => {
    if (activeModal === 'image') {
      setTargetPage(currentPage)
      setPreviewUrl(null)
      setNaturalDims(null)
    }
  }, [activeModal, currentPage])

  if (activeModal !== 'image') return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      const rawUrl = event.target?.result as string
      if (!rawUrl) return
      const img = new Image()
      img.onload = () => {
        // Normalize to PNG via offscreen canvas so JPEG/WebP/PNG all embed reliably in pdf-lib
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          setPreviewUrl(canvas.toDataURL('image/png'))
        } else {
          setPreviewUrl(rawUrl)
        }
        setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight })
      }
      img.src = rawUrl
    }
    reader.readAsDataURL(file)
  }

  const handleInsert = () => {
    if (!previewUrl) return
    const pageMeta = pages.find((p) => p.pageNumber === targetPage)
    const pageAspect = pageMeta && pageMeta.height > 0 ? pageMeta.width / pageMeta.height : 595.28 / 841.89
    const imgWidthPct = 32
    let imgHeightPct = 22
    if (naturalDims && naturalDims.w > 0 && naturalDims.h > 0) {
      imgHeightPct = Math.max(
        5,
        Math.min(70, Math.round(imgWidthPct * (naturalDims.h / naturalDims.w) * pageAspect * 10) / 10)
      )
    }

    const newId = addAnnotation({
      type: 'image',
      pageNumber: targetPage,
      x: 34,
      y: 35,
      width: imgWidthPct,
      height: imgHeightPct,
      dataUrl: previewUrl,
    })

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage)
    }
    const created = usePdfStore.getState().annotations.find((a) => a.id === newId)
    if (created) {
      setSelectedObject({ type: 'image', id: newId, data: created })
      setPropertiesOpen(true)
    }
    setActiveTool('select')
    setActiveModal(null)
    setPreviewUrl(null)
    setNaturalDims(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161f] border border-[#262a38] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#212432] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Insert Image</h3>
              <p className="text-xs text-slate-400">Add logos, stamps or photos</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f222d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Target Page
            </label>
            <select
              value={targetPage}
              onChange={(e) => setTargetPage(Number(e.target.value))}
              className="w-full bg-[#1a1c27] border border-[#272b3a] text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-brand-violet"
            >
              {pages.map((p) => (
                <option key={p.pageNumber} value={p.pageNumber}>
                  Page {p.pageNumber}
                </option>
              ))}
            </select>
          </div>

          {!previewUrl ? (
            <label className="border-2 border-dashed border-[#292d3c] hover:border-brand-violet bg-[#191b26] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center">
              <Upload className="w-8 h-8 text-teal-400 mb-2" />
              <span className="text-xs font-semibold text-white">Select Image File</span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                PNG, JPG, or JPEG
              </span>
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative border border-[#272b3a] bg-black/40 rounded-xl p-4 flex items-center justify-center max-h-48">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-40 max-w-full object-contain rounded"
              />
              <button
                onClick={() => setPreviewUrl(null)}
                className="absolute top-2 right-2 p-1 rounded-full bg-rose-600 text-white hover:scale-110"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#11131a] border-t border-[#212432] flex items-center justify-end gap-3">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!previewUrl}
            className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <Check className="w-4 h-4" />
            Insert on Page {targetPage}
          </button>
        </div>
      </div>
    </div>
  )
}

