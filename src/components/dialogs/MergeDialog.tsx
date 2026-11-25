import React, { useState, useEffect } from 'react'
import {
  X,
  Files,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  FileCheck,
  Eye,
  ArrowLeft,
  Sparkles,
  FileText,
  CheckCircle,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PdfEditor } from '@/core/pdf/pdf-editor'
import { PdfLoader } from '@/core/pdf/pdf-loader'
import { getFileAdapter } from '@/adapters'
import { MergeFileItem } from '@/types'
import { PDFDocument } from 'pdf-lib'

interface MergedPagePreview {
  pageNumber: number
  sourceFileName: string
  dataUrl?: string
}

export const MergeDialog: React.FC = () => {
  const { currentDoc, activeModal, setActiveModal, loadDocumentFromData } = usePdfStore()

  const [mode, setMode] = useState<'list' | 'preview'>('list')
  const [fileList, setFileList] = useState<MergeFileItem[]>([])
  const [filePageCounts, setFilePageCounts] = useState<{ [id: string]: number }>({})

  // Preview state
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [mergedPdfBytes, setMergedPdfBytes] = useState<Uint8Array | null>(null)
  const [mergedPages, setMergedPages] = useState<MergedPagePreview[]>([])
  const [selectedPreviewPage, setSelectedPreviewPage] = useState<number>(1)

  // Initialize fileList when modal opens
  useEffect(() => {
    if (activeModal === 'merge') {
      setMode('list')
      setMergedPdfBytes(null)
      setMergedPages([])

      if (currentDoc) {
        setFileList([
          {
            id: 'current-doc',
            name: currentDoc.name,
            size: currentDoc.size,
            data: currentDoc.data,
          },
        ])
        // Count pages
        countPages('current-doc', currentDoc.data)
      } else {
        setFileList([])
      }
    }
  }, [activeModal, currentDoc])

  const countPages = async (id: string, data: Uint8Array) => {
    try {
      const doc = await PDFDocument.load(data, { ignoreEncryption: true })
      setFilePageCounts((prev) => ({ ...prev, [id]: doc.getPageCount() }))
    } catch {
      setFilePageCounts((prev) => ({ ...prev, [id]: 1 }))
    }
  }

  if (activeModal !== 'merge') return null

  const handleAddFiles = async () => {
    const adapter = getFileAdapter()
    const opened = await adapter.openFiles()
    if (opened.length > 0) {
      const newItems: MergeFileItem[] = opened.map((doc) => {
        const id = Math.random().toString(36).substring(2, 9)
        countPages(id, doc.data)
        return {
          id,
          name: doc.name,
          size: doc.size,
          data: doc.data,
        }
      })
      setFileList((prev) => [...prev, ...newItems])
    }
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const nextList = [...fileList]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= nextList.length) return
    const temp = nextList[index]
    nextList[index] = nextList[target]
    nextList[target] = temp
    setFileList(nextList)
  }

  const handleRemove = (index: number) => {
    setFileList((prev) => prev.filter((_, i) => i !== index))
  }

  // GENERATE MERGED PREVIEW
  const handleGeneratePreview = async () => {
    if (fileList.length < 2) {
      alert('Pilih minimal 2 file PDF untuk digabungkan.')
      return
    }

    setIsProcessing(true)
    setStatusMsg('Menggabungkan dokumen untuk preview...')
    try {
      // 1. Merge in-memory
      const mergedBytes = await PdfEditor.mergePdfs(fileList.map((f) => f.data))
      setMergedPdfBytes(mergedBytes)

      // 2. Load with PDF.js to generate thumbnails
      setStatusMsg('Memuat preview halaman...')
      const pdfJsDoc = await PdfLoader.loadDocument(mergedBytes)
      const totalPages = pdfJsDoc.numPages

      // Map which page came from which file
      const pageMapping: MergedPagePreview[] = []
      let runningPage = 1

      for (const file of fileList) {
        const pCount = filePageCounts[file.id] || 1
        for (let p = 1; p <= pCount; p++) {
          if (runningPage <= totalPages) {
            pageMapping.push({
              pageNumber: runningPage,
              sourceFileName: file.name,
            })
            runningPage++
          }
        }
      }

      // If any remaining pages
      while (runningPage <= totalPages) {
        pageMapping.push({
          pageNumber: runningPage,
          sourceFileName: fileList[fileList.length - 1]?.name || 'Document',
        })
        runningPage++
      }

      setMergedPages(pageMapping)
      setSelectedPreviewPage(1)
      setMode('preview')

      // Generate thumbnails asynchronously
      setTimeout(async () => {
        const updated = [...pageMapping]
        for (let i = 1; i <= Math.min(totalPages, 30); i++) {
          try {
            const thumb = await PdfLoader.generateThumbnail(pdfJsDoc, i, 180)
            if (updated[i - 1]) {
              updated[i - 1] = { ...updated[i - 1], dataUrl: thumb }
            }
          } catch {
            // ignore
          }
        }
        setMergedPages([...updated])
      }, 50)
    } catch (e) {
      console.error(e)
      alert('Gagal menggabungkan file PDF. Pastikan file valid dan tidak terkunci password.')
    } finally {
      setIsProcessing(false)
      setStatusMsg('')
    }
  }

  // SAVE OR OPEN FINAL MERGED PDF
  const handleFinalSave = async (openInEditor = false) => {
    if (!mergedPdfBytes) return

    setIsProcessing(true)
    setStatusMsg(openInEditor ? 'Membuka di editor...' : 'Menyimpan dokumen...')
    try {
      const mergedName = `merged_${Date.now()}.pdf`

      if (openInEditor) {
        await loadDocumentFromData(mergedPdfBytes, mergedName)
        setActiveModal(null)
      } else {
        const adapter = getFileAdapter()
        await adapter.saveFile(mergedPdfBytes, mergedName)
        setActiveModal(null)
      }
    } catch (e) {
      console.error(e)
      alert('Gagal menyimpan dokumen gabungan.')
    } finally {
      setIsProcessing(false)
      setStatusMsg('')
    }
  }

  const totalEstPages = fileList.reduce(
    (acc, f) => acc + (filePageCounts[f.id] || 1),
    0
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#12141c] border border-[#262a38] rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 px-6 border-b border-[#212432] flex items-center justify-between bg-[#151722]">
          <div className="flex items-center gap-3">
            {mode === 'preview' ? (
              <button
                onClick={() => setMode('list')}
                className="w-8 h-8 rounded-lg bg-[#202434] hover:bg-[#2b3046] text-slate-300 hover:text-white flex items-center justify-center transition-colors mr-1"
                title="Kembali ke Atur File"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
                <Files className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                {mode === 'list' ? 'Merge PDFs (Gabungkan PDF)' : 'Preview Dokumen Gabungan'}
                {mode === 'preview' && (
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-violet-500/20 text-purple-300 border border-violet-500/30">
                    {mergedPages.length} Halaman Total
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'list'
                  ? `${fileList.length} file dipilih (Estimasi ~${totalEstPages} halaman)`
                  : `Menampilkan preview hasil gabungan dari ${fileList.length} file PDF`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveModal(null)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1f222d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {mode === 'list' ? (
            /* VIEW 1: FILE LIST & REORDERING */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Daftar File yang Akan Digabungkan ({fileList.length})
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gunakan tombol panah untuk mengatur urutan susunan file.
                  </p>
                </div>

                <button
                  onClick={handleAddFiles}
                  className="px-3 py-1.5 rounded-xl bg-brand-violet/20 hover:bg-brand-violet/30 border border-brand-violet/40 text-xs text-purple-300 hover:text-white flex items-center gap-1.5 font-medium transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Tambah File PDF...
                </button>
              </div>

              {fileList.length === 0 ? (
                <div
                  onClick={handleAddFiles}
                  className="border-2 border-dashed border-[#282d3f] hover:border-brand-violet rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors bg-[#151722]/60"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#202434] text-slate-400 flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Klik untuk Menambahkan File PDF
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Pilih 2 atau lebih file PDF yang ingin digabungkan
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                  {fileList.map((file, idx) => {
                    const pagesInFile = filePageCounts[file.id]

                    return (
                      <div
                        key={file.id}
                        className="flex items-center justify-between bg-[#171a25] border border-[#262a3a] p-3.5 rounded-xl text-xs hover:border-slate-500/50 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-[#222636] text-purple-300 border border-purple-500/20 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <p className="font-semibold text-slate-200 truncate text-sm">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                              <span>{(file.size / 1024).toFixed(1)} KB</span>
                              <span className="w-1 h-1 rounded-full bg-slate-600" />
                              <span className="text-purple-300 font-medium">
                                {pagesInFile !== undefined ? `${pagesInFile} Halaman` : 'Memuat...'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0}
                            title="Geser ke Atas"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#222636] disabled:opacity-20 transition-colors"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === fileList.length - 1}
                            title="Geser ke Bawah"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#222636] disabled:opacity-20 transition-colors"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <div className="w-px h-4 bg-slate-700/60 mx-1" />
                          <button
                            onClick={() => handleRemove(idx)}
                            title="Hapus dari Daftar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* VIEW 2: LIVE MERGED DOCUMENT PREVIEW */
            <div className="space-y-4">
              <div className="bg-[#171a25] border border-[#272b3c] p-3.5 rounded-xl flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Dokumen berhasil digabungkan! Klik halaman untuk memeriksa sebelum menyimpan.
                  </span>
                </div>
                <button
                  onClick={() => setMode('list')}
                  className="text-xs text-brand-violet hover:text-purple-300 font-semibold underline underline-offset-2"
                >
                  Ubah Urutan File
                </button>
              </div>

              {/* Grid of merged page thumbnails */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[52vh] overflow-y-auto p-1 pr-2">
                {mergedPages.map((page) => {
                  const isCurrent = page.pageNumber === selectedPreviewPage

                  return (
                    <div
                      key={page.pageNumber}
                      onClick={() => setSelectedPreviewPage(page.pageNumber)}
                      className={`group relative flex flex-col items-center bg-[#171924] rounded-xl p-2.5 border-2 transition-all cursor-pointer shadow-md select-none ${
                        isCurrent
                          ? 'border-brand-violet ring-2 ring-brand-violet/30 bg-[#1c1a2d]'
                          : 'border-[#262a38] hover:border-slate-500'
                      }`}
                    >
                      {/* Thumbnail Container */}
                      <div className="w-full aspect-[1/1.414] bg-white rounded-lg overflow-hidden border border-slate-300/30 shadow-inner flex items-center justify-center">
                        {page.dataUrl ? (
                          <img
                            src={page.dataUrl}
                            alt={`Halaman ${page.pageNumber}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-400">
                            <FileText className="w-6 h-6 text-slate-400" />
                            <span className="text-[10px] font-mono">Page {page.pageNumber}</span>
                          </div>
                        )}
                      </div>

                      {/* Info below thumbnail */}
                      <div className="mt-2 w-full text-center truncate">
                        <span className="text-xs font-semibold text-white block">
                          Halaman {page.pageNumber}
                        </span>
                        <span
                          className="text-[10px] text-slate-400 truncate block mt-0.5"
                          title={page.sourceFileName}
                        >
                          {page.sourceFileName}
                        </span>
                      </div>
                    </div>
                  )
                })}
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
                {statusMsg}
              </span>
            ) : mode === 'list' ? (
              <span>
                Tambahkan minimal 2 file, lalu klik <strong>Lihat Preview Gabungan</strong>.
              </span>
            ) : (
              <span>
                Hasil preview sudah sesuai? Pilih <strong>Buka di Editor</strong> atau <strong>Simpan PDF Gabungan</strong>.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {mode === 'list' ? (
              <>
                <button
                  onClick={() => setActiveModal(null)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors"
                >
                  Batal
                </button>

                <button
                  onClick={handleGeneratePreview}
                  disabled={isProcessing || fileList.length < 2}
                  className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  <Eye className="w-4 h-4" />
                  {isProcessing ? 'Menggabungkan...' : 'Lihat Preview Gabungan'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setMode('list')}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Atur Ulang File
                </button>

                <button
                  onClick={() => handleFinalSave(true)}
                  disabled={isProcessing}
                  className="px-4 py-2 text-xs font-medium text-slate-200 hover:text-white bg-[#1e2230] hover:bg-[#282d3f] border border-[#2b3043] rounded-xl transition-all disabled:opacity-40 flex items-center gap-1.5"
                >
                  <FileCheck className="w-3.5 h-3.5 text-brand-violet" />
                  Buka di Editor
                </button>

                <button
                  onClick={() => handleFinalSave(false)}
                  disabled={isProcessing}
                  className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isProcessing ? 'Menyimpan...' : 'Simpan PDF Gabungan'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
