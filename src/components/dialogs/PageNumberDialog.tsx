import React, { useState } from 'react'
import { X, Hash, Trash2, Check } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PageNumberOptions } from '@/types'

export const PageNumberDialog: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    pageNumberOptions,
    setPageNumbers,
  } = usePdfStore()

  const [format, setFormat] = useState<PageNumberOptions['format']>(
    pageNumberOptions?.format || 'Page 1 of N'
  )
  const [position, setPosition] = useState<PageNumberOptions['position']>(
    pageNumberOptions?.position || 'bottom-center'
  )
  const [fontSize, setFontSize] = useState<number>(pageNumberOptions?.fontSize || 10)
  const [startNumber, setStartNumber] = useState<number>(
    pageNumberOptions?.startNumber || 1
  )

  if (activeModal !== 'page-number') return null

  const formats: { id: PageNumberOptions['format']; label: string; preview: string }[] = [
    { id: '1', label: 'Simple number', preview: '1' },
    { id: '1 / N', label: 'Page / Total', preview: '1 / 5' },
    { id: 'Page 1 of N', label: 'Full text', preview: 'Page 1 of 5' },
    { id: '- 1 -', label: 'Hyphenated', preview: '- 1 -' },
  ]

  const positions: { id: PageNumberOptions['position']; label: string }[] = [
    { id: 'top-center', label: 'Top Center' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'bottom-center', label: 'Bottom Center' },
    { id: 'bottom-right', label: 'Bottom Right' },
  ]

  const handleApply = () => {
    setPageNumbers({
      format,
      position,
      fontSize,
      startNumber,
    })
    setActiveModal(null)
  }

  const handleRemove = () => {
    setPageNumbers(null)
    setActiveModal(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-[#14161f] border border-[#262a3a] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#212433] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Page Numbers</h2>
              <p className="text-xs text-slate-400">Add headers or footers with page numbers</p>
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
        <div className="p-6 space-y-4 text-sm">
          {/* Format selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Numbering Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    format === f.id
                      ? 'bg-blue-500/15 border-blue-500 text-white'
                      : 'bg-[#181a24] border-[#262938] text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-mono text-xs font-semibold text-blue-300">{f.preview}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{f.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Position selection */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Position
            </label>
            <div className="grid grid-cols-3 gap-2">
              {positions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPosition(p.id)}
                  className={`py-2 px-2 rounded-xl border text-xs font-medium text-center transition-all ${
                    position === p.id
                      ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                      : 'bg-[#181a24] border-[#262938] text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start Number & Font Size */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Start Numbering At
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-[#0e1017] border border-[#242738] rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Font Size: {fontSize} pt
              </label>
              <input
                type="range"
                min={8}
                max={16}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer mt-2"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#212433] flex items-center justify-between bg-[#11131a]">
          {pageNumberOptions ? (
            <button
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-[#1e212d] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/20 transition-all"
            >
              <Check className="w-4 h-4" />
              Apply Numbers
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
