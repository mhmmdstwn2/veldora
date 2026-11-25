import React, { useEffect, useState } from 'react'
import { X, Layers, Trash2, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PdfEditor } from '@/core/pdf/pdf-editor'

export const PageManagerDialog: React.FC = () => {
  const { currentDoc, pages, activeModal, setActiveModal, loadDocumentFromData, setCurrentPage } =
    usePdfStore()

  const [order, setOrder] = useState<number[]>(() => pages.map((p) => p.pageNumber))
  const [deleted, setDeleted] = useState<number[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (activeModal === 'pages') {
      setOrder(pages.map((p) => p.pageNumber))
      setDeleted([])
    }
  }, [activeModal, pages])

  if (activeModal !== 'pages' || !currentDoc) return null

  const handleToggleDelete = (pageNumber: number) => {
    if (deleted.includes(pageNumber)) {
      setDeleted(deleted.filter((p) => p !== pageNumber))
    } else {
      if (order.length - deleted.length <= 1) {
        alert('You must keep at least 1 page in the document.')
        return
      }
      setDeleted([...deleted, pageNumber])
    }
  }

  const handleMove = (index: number, direction: 'left' | 'right') => {
    const nextOrder = [...order]
    const target = direction === 'left' ? index - 1 : index + 1
    if (target < 0 || target >= nextOrder.length) return
    const temp = nextOrder[index]
    nextOrder[index] = nextOrder[target]
    nextOrder[target] = temp
    setOrder(nextOrder)
  }

  const handleApplyChanges = async () => {
    setIsProcessing(true)
    try {
      let currentBuffer = currentDoc.data

      // Apply reorder & deletions cleanly in one pass
      const remainingOrder = order.filter((p) => !deleted.includes(p))
      if (remainingOrder.length > 0) {
        currentBuffer = await PdfEditor.reorderPages(currentBuffer, remainingOrder)
        await loadDocumentFromData(currentBuffer, currentDoc.name, currentDoc.path)
        setCurrentPage(1)
      }

      setActiveModal(null)
    } catch (e) {
      console.error(e)
      alert('Failed to update pages.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161f] border border-[#262a38] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#212432] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Organize Pages</h3>
              <p className="text-xs text-slate-400">Reorder, delete or arrange pages</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f222d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content: Grid of pages */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {order.map((pageNumber, idx) => {
              const pageData = pages.find((p) => p.pageNumber === pageNumber)
              const isMarkedDelete = deleted.includes(pageNumber)

              return (
                <div
                  key={pageNumber}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all ${isMarkedDelete
                      ? 'border-rose-700 bg-rose-950/20 opacity-50'
                      : 'border-[#262a38] bg-[#1a1c27] hover:border-slate-500'
                    }`}
                >
                  <div className="w-full aspect-[1/1.414] bg-white rounded-lg overflow-hidden flex items-center justify-center shadow-md relative">
                    {pageData?.dataUrl ? (
                      <img
                        src={pageData.dataUrl}
                        alt={`Page ${pageNumber}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-slate-500 text-xs font-mono">
                        {pageNumber}
                      </span>
                    )}

                    {isMarkedDelete && (
                      <div className="absolute inset-0 bg-rose-950/70 flex items-center justify-center text-rose-300 text-xs font-semibold">
                        Deleted
                      </div>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 mt-2 font-medium">
                    Page {pageNumber}
                  </span>

                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      onClick={() => handleMove(idx, 'left')}
                      disabled={idx === 0}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleToggleDelete(pageNumber)}
                      title={isMarkedDelete ? 'Undo delete' : 'Delete page'}
                      className={`p-1 rounded ${isMarkedDelete
                          ? 'text-rose-400 hover:text-white'
                          : 'text-slate-400 hover:text-rose-400'
                        }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'right')}
                      disabled={idx === order.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#11131a] border-t border-[#212432] flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {deleted.length > 0 && `${deleted.length} pages will be removed`}
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyChanges}
              disabled={isProcessing}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {isProcessing ? 'Applying...' : 'Apply Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
