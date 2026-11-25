import React, { useEffect, useState } from 'react'
import { PDFViewer } from '@embedpdf/viewer-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { FileUp, FileCheck, PenTool, CheckSquare, Radio } from 'lucide-react'

export const EmbedPdfViewer: React.FC = () => {
  const {
    originalDocBytes,
    reviewDocBytes,
    reviewLastSyncedAt,
    currentDoc,
    openFileWithPicker,
    setEditorMode,
    setActiveModal,
  } = usePdfStore()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  const activeBytes =
    reviewDocBytes && reviewDocBytes.byteLength > 0 ? reviewDocBytes : originalDocBytes

  useEffect(() => {
    if (!activeBytes || activeBytes.byteLength === 0) {
      setBlobUrl(null)
      return
    }
    const blob = new Blob([activeBytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    setBlobUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [activeBytes])

  if (!blobUrl) {
    return (
      <div className="flex-1 bg-[#0b0c10] flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-brand-violet/10 border border-brand-violet/20 flex items-center justify-center mb-4 text-brand-violet shadow-xl">
          <FileCheck className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-white mb-2">
          Mode Review & Form Filling
        </h3>
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          Buka file PDF untuk mengisi formulir interaktif (AcroForms), membubuhkan anotasi standar, mengukur skala teknis, dan mengelola halaman.
        </p>
        <button
          onClick={openFileWithPicker}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-violet hover:bg-purple-600 text-white rounded-xl text-xs font-medium shadow-lg shadow-brand-violet/20 transition-all cursor-pointer active:scale-95"
        >
          <FileUp className="w-4 h-4" />
          Buka Dokumen PDF
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 w-full h-full bg-[#0b0c10] overflow-hidden flex flex-col relative">
      {/* Informative Subheader Bar */}
      <div className="h-9 bg-[#101218] border-b border-[#1f222e] px-4 flex items-center justify-between text-xs select-none z-10 shrink-0">
        <div className="flex items-center gap-3 text-slate-300">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full text-[11px]">
            <CheckSquare className="w-3 h-3" />
            Mode Review & Form Active
          </span>
          {reviewLastSyncedAt ? (
            <span className="hidden sm:inline text-emerald-300/90 text-[11px]">
              • Preview POV Pembaca (tersinkron {new Date(reviewLastSyncedAt).toLocaleTimeString('id-ID')})
            </span>
          ) : (
            <span className="hidden sm:inline text-slate-400 text-[11px]">
              AcroForms, Anotasi, Komentar Thread, dan Pengukuran Aktif
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveModal('live-share')}
            className="text-xs text-emerald-400 hover:text-white flex items-center gap-1 font-medium bg-emerald-500/10 hover:bg-emerald-600/30 border border-emerald-500/30 px-2.5 py-1 rounded transition-colors"
            title="Bagikan tampilan Form & Review ini secara live via LAN / Wi-Fi"
          >
            <Radio className="w-3 h-3" />
            <span>Share Live</span>
          </button>

          <button
            onClick={() => setEditorMode('content')}
            className="text-xs text-brand-purple hover:text-purple-300 flex items-center gap-1 font-medium hover:bg-brand-violet/10 px-2 py-1 rounded transition-colors"
            title="Kembali ke mode Canva untuk edit teks atau geser gambar langsung"
          >
            <PenTool className="w-3 h-3" />
            <span>Switch ke Edit Konten (Canva)</span>
          </button>
        </div>
      </div>

      {/* EmbedPDF Viewer Container */}
      <div className="flex-1 w-full h-full overflow-hidden relative">
        <PDFViewer
          key={currentDoc?.name || 'embed-pdf-doc'}
          src={blobUrl}
          style={{ width: '100%', height: '100%' }}
          theme="dark"
        />
      </div>
    </div>
  )
}
