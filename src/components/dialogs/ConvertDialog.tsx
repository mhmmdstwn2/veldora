import React, { useState, useRef } from 'react'
import {
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileArchive,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  FolderOpen,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PdfConverter } from '@/core/pdf/pdf-converter'
import { getFileAdapter } from '@/adapters'

type MainTab = 'from-pdf' | 'to-pdf' | 'excel-to-img'
type FromPdfTarget = 'word' | 'excel' | 'jpg' | 'png'
type ToPdfSource = 'word' | 'excel' | 'images'

interface SelectedFileState {
  name: string
  size: number
  data: Uint8Array
  type?: string
}

export const ConvertDialog: React.FC = () => {
  const { currentDoc, activeModal, setActiveModal, loadDocumentFromData } = usePdfStore()

  const [activeTab, setActiveTab] = useState<MainTab>('from-pdf')

  // From PDF states
  const [fromPdfTarget, setFromPdfTarget] = useState<FromPdfTarget>('word')
  const [customPdfFile, setCustomPdfFile] = useState<SelectedFileState | null>(null)

  // To PDF states
  const [toPdfSource, setToPdfSource] = useState<ToPdfSource>('word')
  const [selectedOfficeFile, setSelectedOfficeFile] = useState<SelectedFileState | null>(null)
  const [selectedImageFiles, setSelectedImageFiles] = useState<Array<{ name: string; size: number; data: Uint8Array; type: string; previewUrl: string }>>([])

  // Excel to Image states
  const [excelImageFile, setExcelImageFile] = useState<SelectedFileState | null>(null)
  const [excelImgFormat, setExcelImgFormat] = useState<'png' | 'jpg'>('png')

  // Progress & Result
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [successInfo, setSuccessInfo] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (activeModal !== 'convert') return null

  const resetMessages = () => {
    setStatusMessage('')
    setSuccessInfo(null)
  }

  // --- Handlers: Dari PDF (PDF to Other Formats) ---
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const buffer = await file.arrayBuffer()
    setCustomPdfFile({
      name: file.name,
      size: file.size,
      data: new Uint8Array(buffer),
    })
    resetMessages()
  }

  const handleConvertFromPdf = async () => {
    const targetData = customPdfFile ? customPdfFile.data : currentDoc?.data
    const docName = customPdfFile ? customPdfFile.name : currentDoc?.name || 'document.pdf'
    if (!targetData) {
      alert('Silakan pilih dokumen PDF terlebih dahulu.')
      return
    }

    setIsProcessing(true)
    resetMessages()
    const baseName = docName.replace(/\.[^/.]+$/, '')
    const adapter = getFileAdapter()

    try {
      if (fromPdfTarget === 'word') {
        setStatusMessage('Mengekstrak teks & tata letak ke Microsoft Word...')
        const docxBytes = await PdfConverter.pdfToWord(targetData)
        const fileName = `${baseName}.docx`
        await adapter.downloadFile(docxBytes, fileName)
        setSuccessInfo(`Berhasil mengonversi ke Word: ${fileName}`)
      } else if (fromPdfTarget === 'excel') {
        setStatusMessage('Mengekstrak baris & kolom tabel ke Microsoft Excel...')
        const xlsxBytes = await PdfConverter.pdfToExcel(targetData)
        const fileName = `${baseName}.xlsx`
        await adapter.downloadFile(xlsxBytes, fileName)
        setSuccessInfo(`Berhasil mengonversi ke Excel: ${fileName}`)
      } else if (fromPdfTarget === 'jpg' || fromPdfTarget === 'png') {
        setStatusMessage(`Merender halaman ke gambar ${fromPdfTarget.toUpperCase()}...`)
        const zipBytes = await PdfConverter.pdfToImagesZip(targetData, fromPdfTarget)
        const fileName = `${baseName}_${fromPdfTarget}_images.zip`
        await adapter.downloadFile(zipBytes, fileName)
        setSuccessInfo(`Berhasil mengarsipkan gambar halaman ke ${fileName}`)
      }
    } catch (err: any) {
      console.error(err)
      alert(`Gagal melakukan konversi: ${err.message || 'Terjadi kesalahan sistem'}`)
    } finally {
      setIsProcessing(false)
      setStatusMessage('')
    }
  }

  // --- Handlers: Menjadi PDF (Word / Excel / Images to PDF) ---
  const handleOfficeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const buffer = await file.arrayBuffer()
    setSelectedOfficeFile({
      name: file.name,
      size: file.size,
      data: new Uint8Array(buffer),
    })
    resetMessages()
  }

  const handleImageFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const newItems: Array<{ name: string; size: number; data: Uint8Array; type: string; previewUrl: string }> = []
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i]
      const buffer = await file.arrayBuffer()
      const previewUrl = URL.createObjectURL(file)
      newItems.push({
        name: file.name,
        size: file.size,
        data: new Uint8Array(buffer),
        type: file.type || 'image/png',
        previewUrl,
      })
    }
    setSelectedImageFiles((prev) => [...prev, ...newItems])
    resetMessages()
  }

  const handleConvertToPdf = async (openInEditor = false) => {
    setIsProcessing(true)
    resetMessages()
    const adapter = getFileAdapter()

    try {
      let pdfBytes: Uint8Array | null = null
      let outputName = 'document_converted.pdf'

      if (toPdfSource === 'word') {
        if (!selectedOfficeFile) throw new Error('Silakan pilih file Word (.docx) terlebih dahulu.')
        setStatusMessage('Mengurai dokumen Word & merender ke layout PDF...')
        pdfBytes = await PdfConverter.wordToPdf(selectedOfficeFile.data)
        outputName = `${selectedOfficeFile.name.replace(/\.[^/.]+$/, '')}.pdf`
      } else if (toPdfSource === 'excel') {
        if (!selectedOfficeFile) throw new Error('Silakan pilih file Excel (.xlsx / .csv) terlebih dahulu.')
        setStatusMessage('Mengurai spreadsheet & merender tabel PDF berformat rapi...')
        pdfBytes = await PdfConverter.excelToPdf(selectedOfficeFile.data)
        outputName = `${selectedOfficeFile.name.replace(/\.[^/.]+$/, '')}.pdf`
      } else if (toPdfSource === 'images') {
        if (selectedImageFiles.length === 0) throw new Error('Silakan pilih satu atau lebih gambar.')
        setStatusMessage('Menyatukan gambar-gambar menjadi halaman PDF...')
        pdfBytes = await PdfConverter.imagesToPdf(selectedImageFiles)
        outputName = `images_converted_${Date.now()}.pdf`
      }

      if (!pdfBytes) throw new Error('Hasil konversi PDF kosong.')

      if (openInEditor) {
        await loadDocumentFromData(pdfBytes, outputName)
        setActiveModal(null)
      } else {
        await adapter.downloadFile(pdfBytes, outputName)
        setSuccessInfo(`Berhasil membuat dokumen PDF: ${outputName}`)
      }
    } catch (err: any) {
      console.error(err)
      alert(`Gagal konversi ke PDF: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setIsProcessing(false)
      setStatusMessage('')
    }
  }

  // --- Handlers: Excel ke Gambar ---
  const handleExcelImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const buffer = await file.arrayBuffer()
    setExcelImageFile({
      name: file.name,
      size: file.size,
      data: new Uint8Array(buffer),
    })
    resetMessages()
  }

  const handleConvertExcelToImages = async () => {
    if (!excelImageFile) {
      alert('Silakan pilih file spreadsheet Excel terlebih dahulu.')
      return
    }

    setIsProcessing(true)
    resetMessages()
    setStatusMessage('Merender lembar kerja Excel ke gambar beresolusi tinggi...')
    const adapter = getFileAdapter()
    const baseName = excelImageFile.name.replace(/\.[^/.]+$/, '')

    try {
      const zipBytes = await PdfConverter.excelToImagesZip(excelImageFile.data, excelImgFormat)
      const fileName = `${baseName}_sheets_${excelImgFormat}.zip`
      await adapter.downloadFile(zipBytes, fileName)
      setSuccessInfo(`Berhasil mengekspor lembar spreadsheet ke ${fileName}`)
    } catch (err: any) {
      console.error(err)
      alert(`Gagal konversi Excel ke Gambar: ${err.message || 'Terjadi kesalahan'}`)
    } finally {
      setIsProcessing(false)
      setStatusMessage('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12141d] border border-[#232737] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#202331] flex items-center justify-between bg-[#151824]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-violet to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-brand-violet/20">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-base">Studio Konversi Dokumen</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-violet/20 text-brand-violet border border-brand-violet/30">
                  Offline & Privat
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Konversi format PDF, Word, Excel, dan Gambar dengan 100% pemrosesan lokal
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-[#1f2231] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 bg-[#12141d] border-b border-[#1f2231]">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab('from-pdf')
                resetMessages()
              }}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${activeTab === 'from-pdf'
                  ? 'border-brand-violet text-brand-violet bg-[#171a26]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              <FileText className="w-4 h-4" />
              Dari PDF (ke Word / Excel / Gambar)
            </button>
            <button
              onClick={() => {
                setActiveTab('to-pdf')
                resetMessages()
              }}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${activeTab === 'to-pdf'
                  ? 'border-brand-violet text-brand-violet bg-[#171a26]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              Menjadi PDF (Word / Excel / Gambar)
            </button>
            <button
              onClick={() => {
                setActiveTab('excel-to-img')
                resetMessages()
              }}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${activeTab === 'excel-to-img'
                  ? 'border-brand-violet text-brand-violet bg-[#171a26]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Excel ke Gambar
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: DARI PDF */}
          {activeTab === 'from-pdf' && (
            <div className="space-y-5">
              {/* Document Source Selection */}
              <div className="bg-[#171924] p-4 rounded-xl border border-[#232738] flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Sumber Dokumen PDF
                  </p>
                  <p className="text-sm font-medium text-white mt-1">
                    {customPdfFile
                      ? customPdfFile.name
                      : currentDoc
                        ? currentDoc.name
                        : 'Tidak ada dokumen terbuka'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {customPdfFile
                      ? `${(customPdfFile.size / 1024).toFixed(1)} KB (File Eksternal)`
                      : currentDoc
                        ? `${currentDoc.pageCount} Halaman • ${(currentDoc.size / 1024).toFixed(1)} KB (Dokumen Aktif)`
                        : 'Buka dokumen di Veldora atau pilih file PDF dari perangkat'}
                  </p>
                </div>
                <div>
                  <label className="cursor-pointer px-3.5 py-1.5 rounded-lg border border-[#2e3347] bg-[#1d2030] hover:bg-[#25293d] text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5 shadow-sm">
                    <FolderOpen className="w-3.5 h-3.5 text-brand-violet" />
                    Pilih PDF Lain
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Target Format Options */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Pilih Format Tujuan
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Word */}
                  <div
                    onClick={() => {
                      setFromPdfTarget('word')
                      resetMessages()
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${fromPdfTarget === 'word'
                        ? 'border-blue-500 bg-blue-500/10 text-white shadow-md'
                        : 'border-[#242838] bg-[#161823] text-slate-400 hover:border-[#32374d]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                        W
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-white">Microsoft Word (.docx)</p>
                        <p className="text-[11px] text-slate-400">Dapat diedit penuh di Word</p>
                      </div>
                    </div>
                  </div>

                  {/* Excel */}
                  <div
                    onClick={() => {
                      setFromPdfTarget('excel')
                      resetMessages()
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${fromPdfTarget === 'excel'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-md'
                        : 'border-[#242838] bg-[#161823] text-slate-400 hover:border-[#32374d]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        X
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-white">Microsoft Excel (.xlsx)</p>
                        <p className="text-[11px] text-slate-400">Ekstrak tabel & baris data</p>
                      </div>
                    </div>
                  </div>

                  {/* JPG */}
                  <div
                    onClick={() => {
                      setFromPdfTarget('jpg')
                      resetMessages()
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${fromPdfTarget === 'jpg'
                        ? 'border-amber-500 bg-amber-500/10 text-white shadow-md'
                        : 'border-[#242838] bg-[#161823] text-slate-400 hover:border-[#32374d]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-white">Gambar JPG (ZIP)</p>
                        <p className="text-[11px] text-slate-400">Semua halaman, kompresi efisien</p>
                      </div>
                    </div>
                  </div>

                  {/* PNG */}
                  <div
                    onClick={() => {
                      setFromPdfTarget('png')
                      resetMessages()
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${fromPdfTarget === 'png'
                        ? 'border-fuchsia-500 bg-fuchsia-500/10 text-white shadow-md'
                        : 'border-[#242838] bg-[#161823] text-slate-400 hover:border-[#32374d]'
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-white">Gambar PNG (ZIP)</p>
                        <p className="text-[11px] text-slate-400">Resolusi tinggi & tajam (2x retina)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MENJADI PDF */}
          {activeTab === 'to-pdf' && (
            <div className="space-y-5">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-2 bg-[#171924] p-1.5 rounded-xl border border-[#242839]">
                <button
                  onClick={() => {
                    setToPdfSource('word')
                    setSelectedOfficeFile(null)
                    resetMessages()
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${toPdfSource === 'word'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Word (.docx)
                </button>
                <button
                  onClick={() => {
                    setToPdfSource('excel')
                    setSelectedOfficeFile(null)
                    resetMessages()
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${toPdfSource === 'excel'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (.xlsx / .csv)
                </button>
                <button
                  onClick={() => {
                    setToPdfSource('images')
                    setSelectedImageFiles([])
                    resetMessages()
                  }}
                  className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${toPdfSource === 'images'
                      ? 'bg-fuchsia-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                    }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Gambar ke PDF
                </button>
              </div>

              {/* Office File Dropzone */}
              {toPdfSource !== 'images' ? (
                <div className="space-y-3">
                  <label className="border-2 border-dashed border-[#292d3e] hover:border-brand-violet bg-[#161823] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                    <div className="w-12 h-12 rounded-xl bg-[#202333] group-hover:bg-brand-violet/20 flex items-center justify-center text-brand-violet transition-colors mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {toPdfSource === 'word'
                        ? 'Pilih File Dokumen Microsoft Word'
                        : 'Pilih File Dokumen Microsoft Excel'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      {toPdfSource === 'word'
                        ? 'Format yang didukung: .docx'
                        : 'Format yang didukung: .xlsx, .xls, .csv'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={
                        toPdfSource === 'word'
                          ? '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                          : '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
                      }
                      onChange={handleOfficeFileUpload}
                      className="hidden"
                    />
                  </label>

                  {selectedOfficeFile && (
                    <div className="p-3 bg-[#191c28] border border-emerald-500/30 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-white">
                            {selectedOfficeFile.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {(selectedOfficeFile.size / 1024).toFixed(1)} KB • Siap dikonversi
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedOfficeFile(null)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Multi Image Dropzone */
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-[#292d3e] hover:border-brand-violet bg-[#161823] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                    <div className="w-10 h-10 rounded-xl bg-[#202333] group-hover:bg-brand-violet/20 flex items-center justify-center text-brand-violet transition-colors mb-2">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-white">Pilih Satu atau Beberapa Gambar</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Format: PNG, JPG, JPEG, WebP
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleImageFilesUpload}
                      className="hidden"
                    />
                  </label>

                  {selectedImageFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Gambar Terpilih ({selectedImageFiles.length} Halaman)
                        </p>
                        <button
                          onClick={() => setSelectedImageFiles([])}
                          className="text-[11px] text-rose-400 hover:underline"
                        >
                          Hapus Semua
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 bg-[#151722] rounded-xl border border-[#232737]">
                        {selectedImageFiles.map((img, idx) => (
                          <div
                            key={idx}
                            className="relative group rounded-lg overflow-hidden border border-[#2c3044] bg-[#0c0d12] aspect-[3/4] flex items-center justify-center"
                          >
                            <img
                              src={img.previewUrl}
                              alt={img.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1 text-center">
                              <span className="text-[10px] text-white font-medium truncate w-full px-1">
                                Hal {idx + 1}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedImageFiles((prev) => prev.filter((_, i) => i !== idx))
                                }}
                                className="mt-1 text-rose-400 hover:text-rose-300 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="absolute bottom-1 left-1 bg-black/70 px-1 py-0.5 rounded text-[9px] text-slate-300 font-bold">
                              {idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXCEL KE GAMBAR */}
          {activeTab === 'excel-to-img' && (
            <div className="space-y-5">
              <label className="border-2 border-dashed border-[#292d3e] hover:border-emerald-500 bg-[#161823] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
                <div className="w-12 h-12 rounded-xl bg-[#202333] group-hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition-colors mb-3">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-white">
                  Pilih Spreadsheet Excel (.xlsx / .xls / .csv)
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Setiap lembar kerja (sheet) akan dirender menjadi gambar tabel berkualitas tinggi
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={handleExcelImageUpload}
                  className="hidden"
                />
              </label>

              {excelImageFile && (
                <div className="p-3 bg-[#191c28] border border-emerald-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-white">{excelImageFile.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {(excelImageFile.size / 1024).toFixed(1)} KB • Siap dirender
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExcelImageFile(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Format selection */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Format Gambar Output
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExcelImgFormat('png')}
                    className={`p-3 rounded-xl border text-center transition-all ${excelImgFormat === 'png'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-[#262938] bg-[#1a1c27] text-slate-400 hover:text-white'
                      }`}
                  >
                    <p className="font-semibold text-xs">PNG Format (Rekomendasi)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Teks dan garis tabel sangat tajam</p>
                  </button>
                  <button
                    onClick={() => setExcelImgFormat('jpg')}
                    className={`p-3 rounded-xl border text-center transition-all ${excelImgFormat === 'jpg'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-[#262938] bg-[#1a1c27] text-slate-400 hover:text-white'
                      }`}
                  >
                    <p className="font-semibold text-xs">JPG Format</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Ukuran file lebih kecil</p>
                  </button>
                </div>
              </div>

              <div className="bg-[#171924] p-3 rounded-xl border border-[#242738] flex items-center gap-2.5 text-xs text-slate-300">
                <FileArchive className="w-4 h-4 text-emerald-400 shrink-0" />
                <p>Seluruh sheet akan dipaketkan ke dalam satu file ZIP yang rapi.</p>
              </div>
            </div>
          )}

          {/* Status and Feedback info */}
          {statusMessage && (
            <div className="p-3 bg-brand-violet/10 border border-brand-violet/30 rounded-xl flex items-center gap-2.5 text-xs text-brand-violet animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successInfo}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#10121a] border-t border-[#1f2231] flex items-center justify-between">
          <button
            onClick={() => setActiveModal(null)}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2.5">
            {/* Tab 1 Action */}
            {activeTab === 'from-pdf' && (
              <button
                onClick={handleConvertFromPdf}
                disabled={isProcessing || (!customPdfFile && !currentDoc)}
                className="px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-brand-violet to-fuchsia-600 hover:from-brand-violet/90 hover:to-fuchsia-500 text-white rounded-xl shadow-lg shadow-brand-violet/20 transition-all flex items-center gap-2 disabled:opacity-40"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Sedang Memproses...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Konversi & Unduh
                  </>
                )}
              </button>
            )}

            {/* Tab 2 Actions (Can either save or open in editor!) */}
            {activeTab === 'to-pdf' && (
              <>
                <button
                  onClick={() => handleConvertToPdf(false)}
                  disabled={
                    isProcessing ||
                    (toPdfSource !== 'images' && !selectedOfficeFile) ||
                    (toPdfSource === 'images' && selectedImageFiles.length === 0)
                  }
                  className="px-4 py-2 text-xs font-medium bg-[#1e2232] hover:bg-[#282d42] text-slate-200 border border-[#2b3046] rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  Simpan PDF
                </button>
                <button
                  onClick={() => handleConvertToPdf(true)}
                  disabled={
                    isProcessing ||
                    (toPdfSource !== 'images' && !selectedOfficeFile) ||
                    (toPdfSource === 'images' && selectedImageFiles.length === 0)
                  }
                  className="px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-brand-violet to-fuchsia-600 hover:from-brand-violet/90 hover:to-fuchsia-500 text-white rounded-xl shadow-lg shadow-brand-violet/20 transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-3.5 h-3.5" />
                      Buka di Editor Veldora
                    </>
                  )}
                </button>
              </>
            )}

            {/* Tab 3 Action */}
            {activeTab === 'excel-to-img' && (
              <button
                onClick={handleConvertExcelToImages}
                disabled={isProcessing || !excelImageFile}
                className="px-5 py-2.5 text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-40"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Unduh Arsip ZIP Gambar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
