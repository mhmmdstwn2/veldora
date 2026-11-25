import React, { useState } from 'react'
import {
  ChevronLeft,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Scissors,
  Files,
  Minimize2,
  RefreshCw,
  RotateCw,
  PenTool,
  CheckSquare,
  FolderOpen,
  Radio,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { getFileAdapter } from '@/adapters'
import { PdfEditor } from '@/core/pdf/pdf-editor'

interface HeaderProps {
  onBackToDashboard: () => void
}

export const Header: React.FC<HeaderProps> = ({ onBackToDashboard }) => {
  const {
    currentDoc,
    openFileWithPicker,
    pages,
    zoom,
    setZoom,
    undo,
    redo,
    canUndo,
    canRedo,
    rotateCurrentPage,
    originalDocBytes,
    annotations,
    originalTexts,
    originalImages,
    watermarkOptions,
    pageNumberOptions,
    setActiveModal,
    editorMode,
    setEditorMode,
  } = usePdfStore()

  const [isExporting, setIsExporting] = useState(false)

  const handleExportPdf = async () => {
    if (!currentDoc) return
    setIsExporting(true)
    try {
      const baseBytes = originalDocBytes || currentDoc.data
      const finalData = await PdfEditor.exportFullEditedPdf(baseBytes, {
        annotations,
        originalTexts,
        originalImages,
        watermark: watermarkOptions || undefined,
        pageNumbers: pageNumberOptions || undefined,
      })

      const adapter = getFileAdapter()
      const baseName = currentDoc.name.replace(/\.[^/.]+$/, '')
      const fileName = `${baseName}_edited.pdf`

      await adapter.saveFile(finalData, fileName)
    } catch (err) {
      console.error('Failed to export PDF:', err)
      alert('Failed to export PDF.')
    } finally {
      setIsExporting(false)
    }
  }

  const zoomPercent = Math.round(zoom * 100)

  return (
    <header className="h-14 bg-[#12141a] border-b border-[#212430] px-4 flex items-center justify-between select-none z-20">
      {/* Left: Back & Document info */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBackToDashboard}
          title="Back to Dashboard"
          className="p-1.5 rounded-lg hover:bg-[#1f222d] text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-sm text-slate-100 truncate max-w-xs md:max-w-md">
            {currentDoc?.name || 'Untitled Document'}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            • {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </span>
        </div>

        <button
          onClick={openFileWithPicker}
          className="ml-1 px-3 py-1.5 rounded-lg bg-[#181b25] hover:bg-[#232736] text-slate-200 hover:text-white border border-[#2b2f42] hover:border-brand-violet text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all shrink-0"
          title="Buka dan edit dokumen PDF lain"
        >
          <FolderOpen className="w-3.5 h-3.5 text-brand-violet" />
          <span>Edit PDF Lain</span>
        </button>
      </div>

      {/* Dual Mode Switcher: Canva Content Editor vs EmbedPDF Review/Form */}
      <div className="flex items-center bg-[#171a22] border border-[#262a39] p-0.5 rounded-lg text-xs font-medium shadow-inner">
        <button
          onClick={() => setEditorMode('content')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            editorMode === 'content'
              ? 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#202432]'
          }`}
          title="Edit teks langsung, geser/ganti gambar, tata letak Canva-grade"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Edit Konten (Canva)</span>
        </button>
        <button
          onClick={() => setEditorMode('review')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
            editorMode === 'review'
              ? 'bg-emerald-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#202432]'
          }`}
          title="EmbedPDF: Isi Form PDF (AcroForms), Anotasi, Komentar Thread, Pengukuran"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Form & Review (EmbedPDF)</span>
        </button>
        <button
          onClick={() => setActiveModal('live-share')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-emerald-400 hover:text-white hover:bg-emerald-600/25 transition-all ml-0.5"
          title="Share Live Form & Review ke pengguna VELDORA lain (LAN / Wi-Fi)"
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Share Live</span>
        </button>
      </div>

      {/* Center: Undo/Redo & Zoom Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="flex items-center bg-[#171a22] border border-[#242735] rounded-lg p-0.5">
          <button
            onClick={undo}
            disabled={!canUndo()}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded-md transition-colors ${
              canUndo()
                ? 'text-slate-300 hover:text-white hover:bg-[#252836]'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded-md transition-colors ${
              canRedo()
                ? 'text-slate-300 hover:text-white hover:bg-[#252836]'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-[#262a38] mx-1 hidden sm:block" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-[#171a22] border border-[#242735] rounded-lg p-0.5">
          <button
            onClick={() => setZoom(zoom - 0.15)}
            title="Zoom Out"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-[#252836] transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono px-2 text-slate-300 min-w-12 text-center">
            {zoomPercent}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.15)}
            title="Zoom In"
            className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-[#252836] transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            title="Reset Zoom"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#252836] transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={() => rotateCurrentPage(90)}
          title="Rotate Current Page (90° Clockwise)"
          className="p-1.5 rounded-lg bg-[#171a22] border border-[#242735] text-slate-300 hover:text-white hover:bg-[#252836] transition-colors hidden sm:block"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Quick Tools & Export */}
      <div className="flex items-center gap-2">
        {/* Quick action buttons */}
        <div className="hidden lg:flex items-center gap-1 text-slate-400 text-xs">
          <button
            onClick={() => setActiveModal('split')}
            className="px-2.5 py-1.5 rounded-lg hover:bg-[#1a1d27] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Scissors className="w-3.5 h-3.5 text-blue-400" />
            Split
          </button>
          <button
            onClick={() => setActiveModal('merge')}
            className="px-2.5 py-1.5 rounded-lg hover:bg-[#1a1d27] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Files className="w-3.5 h-3.5 text-violet-400" />
            Merge
          </button>
          <button
            onClick={() => setActiveModal('compress')}
            className="px-2.5 py-1.5 rounded-lg hover:bg-[#1a1d27] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
            Compress
          </button>
          <button
            onClick={() => setActiveModal('convert')}
            className="px-2.5 py-1.5 rounded-lg hover:bg-[#1a1d27] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-fuchsia-400" />
            Convert
          </button>
        </div>

        {/* Export / Save dropdown */}
        <div className="relative">
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand-purple to-brand-violet hover:from-brand-violet hover:to-purple-500 text-white shadow-md shadow-brand-purple/20 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
