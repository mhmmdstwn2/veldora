import React, { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { DashboardView } from '@/features/dashboard/DashboardView'
import { Header } from '@/components/layout/Header'
import { EditorToolbar } from '@/components/toolbar/EditorToolbar'
import { ThumbnailPanel } from '@/components/sidebar/ThumbnailPanel'
import { PropertiesPanel } from '@/components/sidebar/PropertiesPanel'
import { PdfCanvasViewer } from '@/features/viewer/PdfCanvasViewer'
import { EmbedPdfViewer } from '@/features/review/EmbedPdfViewer'
import { SplitDialog } from '@/components/dialogs/SplitDialog'
import { MergeDialog } from '@/components/dialogs/MergeDialog'
import { CompressDialog } from '@/components/dialogs/CompressDialog'
import { ConvertDialog } from '@/components/dialogs/ConvertDialog'
import { SignatureDialog } from '@/components/dialogs/SignatureDialog'
import { ImageDialog } from '@/components/dialogs/ImageDialog'
import { PageManagerDialog } from '@/components/dialogs/PageManagerDialog'
import { SettingsDialog } from '@/components/dialogs/SettingsDialog'
import { OcrDialog } from '@/components/dialogs/OcrDialog'
import { WatermarkDialog } from '@/components/dialogs/WatermarkDialog'
import { PageNumberDialog } from '@/components/dialogs/PageNumberDialog'
import { CropDialog } from '@/components/dialogs/CropDialog'
import { SecurityDialog } from '@/components/dialogs/SecurityDialog'
import { LiveShareDialog } from '@/components/dialogs/LiveShareDialog'
import { UpdateBanner } from '@/components/layout/UpdateBanner'
import { usePdfStore } from '@/stores/usePdfStore'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor'>('dashboard')
  const {
    currentDoc,
    isLoading,
    errorMessage,
    toastMessage,
    editorMode,
    setReviewDocBytes,
    setEditorMode,
    showToast,
  } = usePdfStore()

  useEffect(() => {
    const api = (window as any)?.electronAPI
    if (!api?.onLiveSharePdfReceived) return
    const off = api.onLiveSharePdfReceived(
      (data: { pdfBytes: Uint8Array; docName: string }) => {
        if (data?.pdfBytes) {
          setReviewDocBytes(new Uint8Array(data.pdfBytes), data.docName)
          setEditorMode('review')
          setCurrentView('editor')
          showToast('Dokumen Form & Review diperbarui secara live oleh Host')
        }
      }
    )
    return () => off?.()
  }, [setReviewDocBytes, setEditorMode, showToast])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c0d10] font-sans antialiased text-slate-100">
      {/* View Switching */}
      {currentView === 'dashboard' || !currentDoc ? (
        <div className="flex w-full h-full">
          <Sidebar
            currentView={currentView}
            onNavigate={(view) => setCurrentView(view)}
          />
          <DashboardView onOpenEditor={() => setCurrentView('editor')} />
        </div>
      ) : (
        <div className="flex flex-col w-full h-full">
          {/* Top Header with Mode Switcher */}
          <Header onBackToDashboard={() => setCurrentView('dashboard')} />

          {/* Editor Action Toolbar (Only shown in Canva Content Mode) */}
          {editorMode === 'content' && <EditorToolbar />}

          {/* Main Workspace Area */}
          <div className="flex flex-1 overflow-hidden relative">
            {editorMode === 'content' ? (
              <>
                {/* Left Page Thumbnails / Outline / Objects Strip */}
                <ThumbnailPanel />

                {/* Central Canvas Workspace (Canva-Grade True Editor) */}
                <PdfCanvasViewer />

                {/* Right Contextual Properties Panel */}
                <PropertiesPanel />
              </>
            ) : (
              /* EmbedPDF Workspace (AcroForms, Annotations, Review, Measurements) */
              <EmbedPdfViewer />
            )}
          </div>
        </div>
      )}

      {/* Global Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-brand-violet animate-spin" />
          <p className="text-sm font-medium text-slate-200">Processing PDF Document...</p>
        </div>
      )}

      {/* Global Error Notice */}
      {errorMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-950/90 border border-rose-600 text-rose-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-md animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-white">Document Notice</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Toast Notification (Ctrl+S & Live Share) */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#121622]/95 border border-emerald-500/40 text-emerald-100 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals & Dialogs */}
      <SplitDialog />
      <MergeDialog />
      <CompressDialog />
      <ConvertDialog />
      <SignatureDialog />
      <ImageDialog />
      <PageManagerDialog />
      <SettingsDialog />
      <OcrDialog />
      <WatermarkDialog />
      <PageNumberDialog />
      <CropDialog />
      <SecurityDialog />
      <LiveShareDialog />
      <UpdateBanner />
    </div>
  )
}

export default App
