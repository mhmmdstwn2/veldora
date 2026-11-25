import React, { useState } from 'react'
import { X, Minimize2, Download, Zap, CheckCircle2 } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PdfCompressor, CompressResult } from '@/core/pdf/pdf-compressor'
import { getFileAdapter } from '@/adapters'

export const CompressDialog: React.FC = () => {
  const { currentDoc, activeModal, setActiveModal } = usePdfStore()

  const [level, setLevel] = useState<'low' | 'medium' | 'high'>('medium')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<CompressResult | null>(null)

  if (activeModal !== 'compress' || !currentDoc) return null

  const handleRunCompress = async () => {
    setIsProcessing(true)
    try {
      const res = await PdfCompressor.compress(currentDoc.data, level)
      setResult(res)
    } catch (e) {
      console.error(e)
      alert('Failed to compress PDF.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveResult = async () => {
    if (!result) return
    const adapter = getFileAdapter()
    const base = currentDoc.name.replace(/\.[^/.]+$/, '')
    const fileName = `${base}_compressed_${level}.pdf`
    await adapter.saveFile(result.compressedData, fileName)
    setActiveModal(null)
  }

  const formatSize = (bytes: number) => {
    return (bytes / 1024).toFixed(1) + ' KB'
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161f] border border-[#262a38] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#212432] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Minimize2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Compress PDF</h3>
              <p className="text-xs text-slate-400">{currentDoc.name}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveModal(null)
              setResult(null)
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f222d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {!result ? (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Compression Level
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'low', label: 'Low', desc: 'Best Quality' },
                      { id: 'medium', label: 'Medium', desc: 'Balanced' },
                      { id: 'high', label: 'High', desc: 'Smallest Size' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setLevel(opt.id)}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        level === opt.id
                          ? 'border-amber-500 bg-amber-500/10 text-white'
                          : 'border-[#262938] bg-[#1a1c27] text-slate-400 hover:text-white'
                      }`}
                    >
                      <p className="font-semibold text-xs">{opt.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#1a1c27] p-3.5 rounded-xl border border-[#272b3a] flex items-center justify-between text-xs">
                <span className="text-slate-400">Current File Size:</span>
                <span className="font-mono font-medium text-white">
                  {formatSize(currentDoc.size)}
                </span>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-800/40 p-4 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Compression Complete!
                  </h4>
                  <p className="text-xs text-emerald-300">
                    Saved {result.savingsPercent}% of original file size.
                  </p>
                </div>
              </div>

              <div className="bg-[#1a1c27] border border-[#272b3a] rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Original Size:</span>
                  <span className="font-mono text-slate-300 line-through">
                    {formatSize(result.originalSize)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-white">New Size:</span>
                  <span className="font-mono text-emerald-400">
                    {formatSize(result.newSize)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#11131a] border-t border-[#212432] flex items-center justify-end gap-3">
          <button
            onClick={() => {
              setActiveModal(null)
              setResult(null)
            }}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors"
          >
            Cancel
          </button>

          {!result ? (
            <button
              onClick={handleRunCompress}
              disabled={isProcessing}
              className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              {isProcessing ? 'Optimizing...' : 'Start Compression'}
            </button>
          ) : (
            <button
              onClick={handleSaveResult}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Download Compressed PDF
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
