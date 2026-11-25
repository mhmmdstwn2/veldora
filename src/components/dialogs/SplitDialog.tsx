import React, { useState, useEffect } from 'react'
import {
  X,
  Scissors,
  Download,
  FileText,
  Check,
  CheckSquare,
  Archive,
  FileCheck,
  Sparkles,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PdfEditor } from '@/core/pdf/pdf-editor'
import { getFileAdapter } from '@/adapters'
import JSZip from 'jszip'

export const SplitDialog: React.FC = () => {
  const { currentDoc, pages, activeModal, setActiveModal, loadDocumentFromData } = usePdfStore()

  const [activeTab, setActiveTab] = useState<'select' | 'all'>('select')
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(pages.length || 1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')

  // Initialize selection when dialog opens or pages change
  useEffect(() => {
    if (pages.length > 0) {
      // Default select all or first page
      setSelectedPages(pages.map((p) => p.pageNumber))
      setFromPage(1)
      setToPage(pages.length)
    }
  }, [pages, activeModal])

  if (activeModal !== 'split' || !currentDoc) return null

  const totalPages = pages.length
  const baseName = currentDoc.name.replace(/\.[^/.]+$/, '')

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) => {
      if (prev.includes(pageNum)) {
        if (prev.length <= 1) return prev // keep at least 1
        return prev.filter((p) => p !== pageNum).sort((a, b) => a - b)
      } else {
        return [...prev, pageNum].sort((a, b) => a - b)
      }
    })
  }

  const handleSelectAll = () => {
    setSelectedPages(pages.map((p) => p.pageNumber))
    setFromPage(1)
    setToPage(totalPages)
  }

  const handleClearSelection = () => {
    setSelectedPages([1])
    setFromPage(1)
    setToPage(1)
  }

  const handleSelectRange = (start: number, end: number) => {
    const s = Math.max(1, Math.min(start, end))
    const e = Math.min(totalPages, Math.max(start, end))
    setFromPage(s)
    setToPage(e)
    const newSel: number[] = []
    for (let i = s; i <= e; i++) {
      newSel.push(i)
    }
    setSelectedPages(newSel)
  }

  const handleSelectOdd = () => {
    const odds = pages.map((p) => p.pageNumber).filter((p) => p % 2 === 1)
    setSelectedPages(odds)
  }

  const handleSelectEven = () => {
    const evens = pages.map((p) => p.pageNumber).filter((p) => p % 2 === 0)
    setSelectedPages(evens)
  }

  // 1. EXTRACT SELECTED PAGES (Custom Range)
  const handleExtractSelected = async (openInEditor = false) => {
    if (selectedPages.length === 0) {
      alert('Pilih minimal 1 halaman untuk diekstrak.')
      return
    }

    setIsProcessing(true)
    setProgressMsg('Mengekstrak halaman terpilih...')
    try {
      const extractedBytes = await PdfEditor.extractPages(currentDoc.data, selectedPages)
      const fileName =
        selectedPages.length === 1
          ? `${baseName}_page_${selectedPages[0]}.pdf`
          : `${baseName}_pages_${selectedPages[0]}-${selectedPages[selectedPages.length - 1]}.pdf`

      if (openInEditor) {
        await loadDocumentFromData(extractedBytes, fileName)
        setActiveModal(null)
      } else {
        const adapter = getFileAdapter()
        await adapter.saveFile(extractedBytes, fileName)
        setActiveModal(null)
      }
    } catch (e) {
      console.error(e)
      alert('Gagal mengekstrak halaman.')
    } finally {
      setIsProcessing(false)
      setProgressMsg('')
    }
  }

  // 2. SPLIT ALL PAGES (All Pages to ZIP Archive)
  const handleSplitAllToZip = async () => {
    setIsProcessing(true)
    setProgressMsg('Menyiapkan arsip ZIP...')
    try {
      const zip = new JSZip()
      const total = pages.length

      for (let i = 0; i < total; i++) {
        const pageNum = pages[i].pageNumber
        setProgressMsg(`Memisahkan halaman ${pageNum} dari ${total}...`)
        const singlePageBytes = await PdfEditor.extractPages(currentDoc.data, [pageNum])
        zip.file(`${baseName}_page_${pageNum}.pdf`, singlePageBytes)
      }

      setProgressMsg('Mengompresi ke file arsip ZIP/RAR...')
      const zipBytes = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })

      const adapter = getFileAdapter()
      const zipFileName = `${baseName}_split_pages.zip`
      await adapter.saveFile(zipBytes, zipFileName)
      setActiveModal(null)
    } catch (e) {
      console.error(e)
      alert('Gagal memproses Split Semua Halaman.')
    } finally {
      setIsProcessing(false)
      setProgressMsg('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#12141c] border border-[#262a38] rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 px-6 border-b border-[#212432] flex items-center justify-between bg-[#151722]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                Split PDF
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {totalPages} Halaman
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{currentDoc.name}</p>
            </div>
          </div>

          <button
            onClick={() => setActiveModal(null)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1f222d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#212432] bg-[#10121a] px-6">
          <button
            onClick={() => setActiveTab('select')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'select'
                ? 'border-brand-violet text-white bg-[#151722]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-brand-violet" />
            Pilih Halaman Tertentu ({selectedPages.length} dipilih)
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'all'
                ? 'border-brand-violet text-white bg-[#151722]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-4 h-4 text-amber-400" />
            Split Semua Halaman (Semua Page Jadi 1 File ZIP/RAR)
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'select' ? (
            /* TAB 1: CUSTOM PAGE SELECTION WITH PREVIEW GRID */
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="bg-[#171a25] border border-[#242738] p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Range inputs */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Rentang:</span>
                  <input
                    type="number"
                    min={1}
                    max={toPage}
                    value={fromPage}
                    onChange={(e) => handleSelectRange(Number(e.target.value), toPage)}
                    className="w-16 bg-[#10121a] border border-[#2b3044] text-white text-center rounded-lg px-2 py-1 focus:outline-none focus:border-brand-violet"
                  />
                  <span className="text-slate-500">s/d</span>
                  <input
                    type="number"
                    min={fromPage}
                    max={totalPages}
                    value={toPage}
                    onChange={(e) => handleSelectRange(fromPage, Number(e.target.value))}
                    className="w-16 bg-[#10121a] border border-[#2b3044] text-white text-center rounded-lg px-2 py-1 focus:outline-none focus:border-brand-violet"
                  />
                  <button
                    onClick={() => handleSelectRange(fromPage, toPage)}
                    className="px-2.5 py-1 bg-[#232738] hover:bg-[#2e3349] text-slate-200 rounded-lg font-medium transition-colors"
                  >
                    Terapkan
                  </button>
                </div>

                {/* Quick selection chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 rounded-lg bg-[#202434] hover:bg-[#2b3044] text-slate-300 transition-colors"
                  >
                    Pilih Semua
                  </button>
                  <button
                    onClick={handleClearSelection}
                    className="px-2.5 py-1 rounded-lg bg-[#202434] hover:bg-[#2b3044] text-slate-300 transition-colors"
                  >
                    Batal Pilih
                  </button>
                  <button
                    onClick={handleSelectOdd}
                    className="px-2.5 py-1 rounded-lg bg-[#202434] hover:bg-[#2b3044] text-slate-300 transition-colors"
                  >
                    Halaman Ganjil
                  </button>
                  <button
                    onClick={handleSelectEven}
                    className="px-2.5 py-1 rounded-lg bg-[#202434] hover:bg-[#2b3044] text-slate-300 transition-colors"
                  >
                    Halaman Genap
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <p>Klik kartu halaman di bawah untuk memilih / membatalkan halaman:</p>
                <p className="font-medium text-brand-violet">
                  {selectedPages.length} dari {totalPages} halaman dipilih
                </p>
              </div>

              {/* Grid of Page Thumbnails */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[50vh] overflow-y-auto p-1 pr-2">
                {pages.map((p) => {
                  const isSelected = selectedPages.includes(p.pageNumber)

                  return (
                    <div
                      key={p.pageNumber}
                      onClick={() => togglePageSelection(p.pageNumber)}
                      className={`group relative flex flex-col items-center bg-[#181a24] rounded-xl p-2.5 border-2 transition-all cursor-pointer shadow-md select-none ${
                        isSelected
                          ? 'border-brand-violet bg-[#1c1a2d] ring-2 ring-brand-violet/30 shadow-purple-900/20'
                          : 'border-[#262a38] hover:border-slate-500 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {/* Checkbox indicator */}
                      <div
                        className={`absolute top-3 right-3 z-10 w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-brand-violet text-white shadow-sm'
                            : 'bg-black/60 border border-slate-500 text-transparent group-hover:border-slate-300'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>

                      {/* Thumbnail container */}
                      <div className="w-full aspect-[1/1.414] bg-white rounded-lg overflow-hidden border border-slate-300/20 shadow-inner flex items-center justify-center relative">
                        {p.dataUrl ? (
                          <img
                            src={p.dataUrl}
                            alt={`Halaman ${p.pageNumber}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-400">
                            <FileText className="w-6 h-6 text-slate-400" />
                            <span className="text-[10px] font-mono">Page {p.pageNumber}</span>
                          </div>
                        )}
                      </div>

                      {/* Page badge */}
                      <div className="mt-2 flex items-center justify-between w-full px-1">
                        <span
                          className={`text-xs font-semibold ${
                            isSelected ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          Halaman {p.pageNumber}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                            Dipilih
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* TAB 2: SPLIT ALL PAGES (PREVIEW ALL FILES & ZIP ARCHIVE) */
            <div className="space-y-4">
              {/* Info banner */}
              <div className="bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl flex items-start gap-3.5 text-xs text-amber-200">
                <Archive className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-300 text-sm">
                    Mode Split Semua Halaman (1 Halaman Per File PDF)
                  </p>
                  <p className="text-amber-200/80 mt-1 leading-relaxed">
                    Setiap halaman dari dokumen ini ({totalPages} halaman) akan otomatis dipisahkan
                    menjadi file PDF mandiri (misal:{' '}
                    <code className="text-white font-mono bg-amber-900/40 px-1 rounded">
                      {baseName}_page_1.pdf
                    </code>
                    ), kemudian dibungkus rapi ke dalam <strong>1 file arsip ZIP/RAR</strong> (
                    <code className="text-white font-mono bg-amber-900/40 px-1 rounded">
                      {baseName}_split_pages.zip
                    </code>
                    ).
                  </p>
                </div>
              </div>

              {/* Preview of all files that will be generated */}
              <div>
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
                  Daftar File yang Akan Dihasilkan ({totalPages} File PDF):
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 max-h-[45vh] overflow-y-auto p-1 pr-2">
                  {pages.map((p) => (
                    <div
                      key={p.pageNumber}
                      className="bg-[#171924] border border-[#272b3c] rounded-xl p-3 flex flex-col items-center gap-2 shadow-sm"
                    >
                      {/* Mini Thumbnail */}
                      <div className="w-24 aspect-[1/1.414] bg-white rounded-md overflow-hidden border border-slate-300/30 shadow-xs flex items-center justify-center">
                        {p.dataUrl ? (
                          <img
                            src={p.dataUrl}
                            alt={`Preview ${p.pageNumber}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">p.{p.pageNumber}</span>
                        )}
                      </div>

                      <div className="w-full text-center truncate">
                        <p className="text-xs font-medium text-slate-200 truncate" title={`${baseName}_page_${p.pageNumber}.pdf`}>
                          {baseName}_page_{p.pageNumber}.pdf
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Halaman {p.pageNumber}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-[#0f1118] border-t border-[#212432] flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {isProcessing ? (
              <span className="flex items-center gap-2 text-brand-violet animate-pulse font-medium">
                <Sparkles className="w-4 h-4 animate-spin" />
                {progressMsg}
              </span>
            ) : activeTab === 'select' ? (
              <span>
                {selectedPages.length} halaman akan diekstrak menjadi 1 dokumen PDF baru.
              </span>
            ) : (
              <span>
                {totalPages} file PDF terpisah akan dikemas dalam 1 file ZIP.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveModal(null)}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors"
            >
              Batal
            </button>

            {activeTab === 'select' ? (
              <>
                <button
                  onClick={() => handleExtractSelected(true)}
                  disabled={isProcessing || selectedPages.length === 0}
                  className="px-4 py-2 text-xs font-medium text-slate-200 hover:text-white bg-[#1e2230] hover:bg-[#282d3f] border border-[#2b3043] rounded-xl transition-all disabled:opacity-40 flex items-center gap-1.5"
                >
                  <FileCheck className="w-3.5 h-3.5 text-brand-violet" />
                  Buka di Editor
                </button>

                <button
                  onClick={() => handleExtractSelected(false)}
                  disabled={isProcessing || selectedPages.length === 0}
                  className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isProcessing ? 'Mengekstrak...' : `Ekstrak & Simpan (${selectedPages.length} Halaman)`}
                </button>
              </>
            ) : (
              <button
                onClick={handleSplitAllToZip}
                disabled={isProcessing}
                className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <Archive className="w-4 h-4" />
                {isProcessing ? 'Mengompresi ZIP...' : `Split Semua (${totalPages} Halaman) & Simpan ZIP`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
