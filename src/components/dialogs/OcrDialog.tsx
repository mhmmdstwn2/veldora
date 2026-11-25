import React, { useState } from 'react'
import { X, Sparkles, CheckCircle2, Download, Search, Edit3 } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { OcrService } from '@/core/ocr/ocr-service'
import { getFileAdapter } from '@/adapters'
import { OcrProgress } from '@/types'

export const OcrDialog: React.FC = () => {
  const {
    currentDoc,
    currentPage,
    pages,
    activeModal,
    setActiveModal,
    applyOcrEditableText,
    loadDocumentFromData,
  } = usePdfStore()

  const [mode, setMode] = useState<'searchable' | 'editable'>('searchable')
  const [langInd, setLangInd] = useState(true)
  const [langEng, setLangEng] = useState(true)
  const [pageScope, setPageScope] = useState<'current' | 'all'>('current')

  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [completedBytes, setCompletedBytes] = useState<Uint8Array | null>(null)

  if (activeModal !== 'ocr' || !currentDoc) return null

  const handleStartOcr = async () => {
    const langs: ('ind' | 'eng')[] = []
    if (langInd) langs.push('ind')
    if (langEng) langs.push('eng')
    if (langs.length === 0) {
      alert('Pilih setidaknya satu bahasa (Indonesia atau Inggris).')
      return
    }

    const targetPages =
      pageScope === 'current'
        ? [currentPage]
        : Array.from({ length: pages.length }, (_, i) => i + 1)

    setIsRunning(true)
    setProgress({
      status: 'Memulai mesin OCR Tesseract...',
      progress: 0.05,
      page: targetPages[0],
      totalPages: targetPages.length,
    })

    try {
      if (mode === 'searchable') {
        // Mode 1: Searchable PDF
        const searchableBytes = await OcrService.createSearchablePdf(
          currentDoc.data,
          langs,
          targetPages,
          (p) => setProgress(p)
        )
        setCompletedBytes(searchableBytes)
      } else {
        // Mode 2: Editable OCR
        const { pdfJsDoc } = usePdfStore.getState()
        const { blocks, imageWidth, imageHeight } = await OcrService.recognizePage(
          pdfJsDoc,
          currentPage,
          langs,
          (p) => setProgress(p),
          1
        )

        const editableElements = OcrService.convertBlocksToEditableText(
          blocks,
          imageWidth,
          imageHeight,
          currentPage
        )

        applyOcrEditableText(editableElements)
        setActiveModal(null)
      }
    } catch (e: any) {
      console.error('OCR Error:', e)
      alert(`OCR Gagal: ${e?.message || 'Periksa dokumen'}`)
    } finally {
      setIsRunning(false)
    }
  }

  const handleDownloadSearchable = async () => {
    if (!completedBytes) return
    const adapter = getFileAdapter()
    const base = currentDoc.name.replace(/\.[^/.]+$/, '')
    await adapter.saveFile(completedBytes, `${base}_searchable.pdf`)
    setActiveModal(null)
    setCompletedBytes(null)
  }

  const handleOpenSearchable = async () => {
    if (!completedBytes) return
    const base = currentDoc.name.replace(/\.[^/.]+$/, '')
    await loadDocumentFromData(completedBytes, `${base}_searchable.pdf`)
    setActiveModal(null)
    setCompletedBytes(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161f] border border-[#262a38] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#212432] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Advanced OCR Engine</h3>
              <p className="text-xs text-slate-400">Optical Character Recognition (Tesseract)</p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveModal(null)
              setCompletedBytes(null)
            }}
            disabled={isRunning}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f222d] disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {!completedBytes ? (
            <>
              {/* OCR Mode Picker */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Pilih Mode OCR
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('searchable')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      mode === 'searchable'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-sm'
                        : 'border-[#262938] bg-[#1a1c27] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                      <Search className="w-3.5 h-3.5 text-emerald-400" />
                      Searchable PDF
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Menambahkan lapisan teks transparan agar dokumen scan dapat dicari dan disalin teksnya.
                    </p>
                  </button>

                  <button
                    onClick={() => setMode('editable')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      mode === 'editable'
                        ? 'border-brand-violet bg-brand-violet/10 text-white shadow-sm'
                        : 'border-[#262938] bg-[#1a1c27] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                      <Edit3 className="w-3.5 h-3.5 text-brand-violet" />
                      Editable OCR
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Mengekstrak blok teks dari scan menjadi elemen teks yang dapat diedit langsung di kanvas.
                    </p>
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Bahasa Teks
                </label>
                <div className="flex items-center gap-4 bg-[#1a1c27] border border-[#272b3a] p-3 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={langInd}
                      onChange={(e) => setLangInd(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>Bahasa Indonesia (ind)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={langEng}
                      onChange={(e) => setLangEng(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <span>English (eng)</span>
                  </label>
                </div>
              </div>

              {/* Page Scope */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Cakupan Halaman
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#1a1c27] border border-[#272b3a] p-1 rounded-xl">
                  <button
                    onClick={() => setPageScope('current')}
                    className={`py-2 rounded-lg font-medium transition-colors ${
                      pageScope === 'current'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Halaman Ini Saja (Hal {currentPage})
                  </button>
                  <button
                    onClick={() => setPageScope('all')}
                    disabled={mode === 'editable'} // Editable is per-page
                    className={`py-2 rounded-lg font-medium transition-colors ${
                      pageScope === 'all'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white disabled:opacity-30'
                    }`}
                  >
                    Semua Halaman ({pages.length})
                  </button>
                </div>
              </div>

              {/* Progress Indicator */}
              {isRunning && progress && (
                <div className="space-y-2 pt-2 border-t border-[#222534]">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-emerald-400 font-medium">{progress.status}</span>
                    <span className="font-mono text-slate-300">
                      {Math.round(progress.progress * 100)}% (Hal {progress.page}/{progress.totalPages})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#1f2230] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                      style={{ width: `${Math.round(progress.progress * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-950/40 border border-emerald-800/40 p-4 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-white">OCR Berhasil!</h4>
                  <p className="text-xs text-emerald-300">
                    Lapisan teks pencarian telah ditanamkan ke dalam PDF secara utuh.
                  </p>
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
              setCompletedBytes(null)
            }}
            disabled={isRunning}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors"
          >
            Batal
          </button>

          {!completedBytes ? (
            <button
              onClick={handleStartOcr}
              disabled={isRunning}
              className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isRunning ? 'Sedang Memproses...' : 'Mulai OCR'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenSearchable}
                className="px-4 py-2 text-xs font-medium bg-[#1e2230] hover:bg-[#282d40] text-slate-200 rounded-xl border border-slate-700"
              >
                Buka di Editor
              </button>
              <button
                onClick={handleDownloadSearchable}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
