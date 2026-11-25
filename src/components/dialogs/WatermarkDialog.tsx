import React, { useState } from 'react'
import { X, Stamp, Trash2, Check } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { WatermarkOptions } from '@/types'

export const WatermarkDialog: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    watermarkOptions,
    setWatermark,
    currentPage,
  } = usePdfStore()

  const [text, setText] = useState(watermarkOptions?.text || 'CONFIDENTIAL')
  const [color, setColor] = useState(watermarkOptions?.color || '#dc2626')
  const [fontSize, setFontSize] = useState(watermarkOptions?.fontSize || 48)
  const [opacity, setOpacity] = useState(watermarkOptions?.opacity || 0.25)
  const [rotation, setRotation] = useState(watermarkOptions?.rotation || -45)
  const [pagesScope, setPagesScope] = useState<'all' | 'custom'>(
    watermarkOptions?.pages || 'all'
  )

  if (activeModal !== 'watermark') return null

  const presets = ['CONFIDENTIAL', 'DRAFT', 'DO NOT COPY', 'APPROVED', 'URGENT']
  const colors = [
    { label: 'Red', hex: '#dc2626' },
    { label: 'Gray', hex: '#64748b' },
    { label: 'Blue', hex: '#2563eb' },
    { label: 'Amber', hex: '#d97706' },
    { label: 'Black', hex: '#000000' },
  ]

  const handleApply = () => {
    if (!text.trim()) {
      setWatermark(null)
      setActiveModal(null)
      return
    }

    const options: WatermarkOptions = {
      text: text.trim(),
      color,
      fontSize,
      opacity,
      rotation,
      pages: pagesScope,
      pageRange: pagesScope === 'custom' ? `${currentPage}` : undefined,
    }

    setWatermark(options)
    setActiveModal(null)
  }

  const handleRemove = () => {
    setWatermark(null)
    setActiveModal(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-[#14161f] border border-[#262a3a] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#212433] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Watermark Settings</h2>
              <p className="text-xs text-slate-400">Add a security text watermark across document pages</p>
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
        <div className="p-6 space-y-5 text-sm">
          {/* Text Input & Quick Presets */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Watermark Text
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. CONFIDENTIAL"
              className="w-full px-3.5 py-2.5 bg-[#0e1017] border border-[#242738] rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-brand-purple"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setText(p)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                    text === p
                      ? 'bg-brand-purple/20 border-brand-purple text-purple-300'
                      : 'bg-[#181a24] border-[#262938] text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Color & Rotation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Color
              </label>
              <div className="flex items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      color === c.hex ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Rotation: {rotation}°
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[-45, 0, 45, 90].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setRotation(deg)}
                    className={`py-1.5 text-xs rounded-lg border font-mono transition-colors ${
                      rotation === deg
                        ? 'bg-brand-purple text-white border-brand-purple'
                        : 'bg-[#181a24] border-[#262938] text-slate-400 hover:text-white'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Font Size & Opacity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-slate-300">Font Size</label>
                <span className="text-xs font-mono text-purple-400">{fontSize} pt</span>
              </div>
              <input
                type="range"
                min={20}
                max={90}
                step={2}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-brand-purple cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-slate-300">Opacity</label>
                <span className="text-xs font-mono text-purple-400">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.05}
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full accent-brand-purple cursor-pointer"
              />
            </div>
          </div>

          {/* Page Scope */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Apply to Pages
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPagesScope('all')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${
                  pagesScope === 'all'
                    ? 'bg-brand-purple/20 border-brand-purple text-purple-300'
                    : 'bg-[#181a24] border-[#262938] text-slate-400 hover:text-white'
                }`}
              >
                All Pages
              </button>
              <button
                type="button"
                onClick={() => setPagesScope('custom')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${
                  pagesScope === 'custom'
                    ? 'bg-brand-purple/20 border-brand-purple text-purple-300'
                    : 'bg-[#181a24] border-[#262938] text-slate-400 hover:text-white'
                }`}
              >
                Current Page ({currentPage}) Only
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#212433] flex items-center justify-between bg-[#11131a]">
          {watermarkOptions ? (
            <button
              onClick={handleRemove}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove Watermark
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
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-brand-purple to-brand-violet hover:from-brand-violet hover:to-purple-500 rounded-xl shadow-lg shadow-brand-purple/20 transition-all"
            >
              <Check className="w-4 h-4" />
              Apply Watermark
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
