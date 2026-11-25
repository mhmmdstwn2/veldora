import React, { useState } from 'react'
import { X, Crop, Check, RotateCcw } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { CropOptions } from '@/types'

export const CropDialog: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    currentPage,
    pages,
    cropCurrentPage,
  } = usePdfStore()

  const [top, setTop] = useState<number>(5)
  const [bottom, setBottom] = useState<number>(5)
  const [left, setLeft] = useState<number>(5)
  const [right, setRight] = useState<number>(5)
  const [isApplying, setIsApplying] = useState(false)

  if (activeModal !== 'crop') return null

  const handleApply = async () => {
    setIsApplying(true)
    try {
      const options: CropOptions = {
        pageNumber: currentPage,
        top,
        bottom,
        left,
        right,
      }
      await cropCurrentPage(options)
      setActiveModal(null)
    } catch (e) {
      console.error('Failed to crop page:', e)
      alert('Gagal memotong halaman PDF')
    } finally {
      setIsApplying(false)
    }
  }

  const handleReset = () => {
    setTop(0)
    setBottom(0)
    setLeft(0)
    setRight(0)
  }

  const currentPageThumbnail = pages.find((p) => p.pageNumber === currentPage)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-[#14161f] border border-[#262a3a] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#212433] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Crop Page {currentPage}</h2>
              <p className="text-xs text-slate-400">Adjust document page margins and boundaries</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f2230] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm">
          {/* Visual Crop Preview */}
          <div className="flex justify-center">
            <div className="relative w-44 h-56 bg-white rounded-lg shadow-md overflow-hidden border border-slate-700 flex items-center justify-center">
              {currentPageThumbnail?.dataUrl ? (
                <img
                  src={currentPageThumbnail.dataUrl}
                  alt="Page Preview"
                  className="w-full h-full object-contain pointer-events-none opacity-80"
                />
              ) : (
                <div className="text-slate-400 text-xs font-mono">Page {currentPage}</div>
              )}

              {/* Crop box overlay */}
              <div
                className="absolute border-2 border-dashed border-amber-400 bg-amber-400/20 pointer-events-none transition-all duration-150"
                style={{
                  top: `${top}%`,
                  bottom: `${bottom}%`,
                  left: `${left}%`,
                  right: `${right}%`,
                }}
              >
                <div className="absolute top-1 left-1 bg-amber-500 text-black text-[9px] font-bold px-1 rounded">
                  Crop Area
                </div>
              </div>
            </div>
          </div>

          {/* Margin sliders */}
          <div className="grid grid-cols-2 gap-4 bg-[#0e1017] p-4 rounded-xl border border-[#242738]">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">Top Margin</span>
                <span className="text-xs font-mono text-amber-400">{top}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={top}
                onChange={(e) => setTop(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">Bottom Margin</span>
                <span className="text-xs font-mono text-amber-400">{bottom}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={bottom}
                onChange={(e) => setBottom(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">Left Margin</span>
                <span className="text-xs font-mono text-amber-400">{left}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={left}
                onChange={(e) => setLeft(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">Right Margin</span>
                <span className="text-xs font-mono text-amber-400">{right}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                value={right}
                onChange={(e) => setRight(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Quick Presets:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTop(5)
                  setBottom(5)
                  setLeft(5)
                  setRight(5)
                }}
                className="px-2.5 py-1 bg-[#1c1f2e] hover:bg-[#25283b] text-slate-300 rounded-lg border border-[#2b2f42] transition-colors"
              >
                5% Uniform
              </button>
              <button
                type="button"
                onClick={() => {
                  setTop(10)
                  setBottom(10)
                  setLeft(10)
                  setRight(10)
                }}
                className="px-2.5 py-1 bg-[#1c1f2e] hover:bg-[#25283b] text-slate-300 rounded-lg border border-[#2b2f42] transition-colors"
              >
                10% Trim
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#1c1f2e] hover:bg-[#25283b] text-slate-400 hover:text-white rounded-lg border border-[#2b2f42] transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#212433] flex items-center justify-end gap-2 bg-[#11131a]">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-[#1e212d] rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg shadow-amber-400/20 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isApplying ? 'Cropping...' : 'Crop Page'}
          </button>
        </div>
      </div>
    </div>
  )
}
