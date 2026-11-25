import React from 'react'
import {
  Plus,
  Trash2,
  RotateCw,
  Layers,
  Bookmark,
  FileText,
  Image as ImageIcon,
  Highlighter,
  Shield,
  Eye,
  PenTool,
  MessageSquare,
  Square,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { PdfOutlineItem } from '@/types'

export const ThumbnailPanel: React.FC = () => {
  const {
    pages,
    currentPage,
    setCurrentPage,
    currentDoc,
    insertBlankPage,
    deletePageFromDoc,
    rotateCurrentPage,
    setActiveModal,
    leftSidebarTab,
    setLeftSidebarTab,
    outline,
    originalTexts,
    originalImages,
    annotations,
    setSelectedObject,
    setPropertiesOpen,
    deleteOriginalText,
    deleteOriginalImage,
    removeAnnotation,
  } = usePdfStore()

  const handleAddBlankPage = async () => {
    if (!currentDoc) return
    await insertBlankPage(currentPage)
  }

  const handleDeletePage = async (pageNumber: number) => {
    if (!currentDoc || pages.length <= 1) {
      alert('Cannot delete the only page in the document.')
      return
    }

    if (confirm(`Are you sure you want to delete page ${pageNumber}?`)) {
      await deletePageFromDoc(pageNumber)
    }
  }

  // Current page elements for Layers tab
  const currentPageTexts = originalTexts.filter(
    (t) => t.pageNumber === currentPage && !t.isDeleted
  )
  const currentPageImages = originalImages.filter(
    (img) => img.pageNumber === currentPage && !img.isDeleted
  )
  const currentPageAnnotations = annotations.filter((a) => a.pageNumber === currentPage)

  const renderOutlineItems = (items: PdfOutlineItem[], depth = 0) => {
    return items.map((item, idx) => (
      <div key={`${depth}-${idx}`} className="flex flex-col">
        <button
          onClick={() => {
            if (item.pageNumber && item.pageNumber > 0) {
              setCurrentPage(item.pageNumber)
            }
          }}
          style={{ paddingLeft: `${12 + depth * 14}px` }}
          className="text-left py-2 pr-2 text-xs text-slate-300 hover:text-white hover:bg-[#1a1d27] rounded-lg transition-colors flex items-center justify-between group"
        >
          <span className="truncate pr-2 font-medium">{item.title}</span>
          {item.pageNumber > 0 && (
            <span className="text-[10px] font-mono text-slate-500 group-hover:text-purple-400">
              p.{item.pageNumber}
            </span>
          )}
        </button>
        {item.items && item.items.length > 0 && (
          <div className="border-l border-[#242735] ml-4">
            {renderOutlineItems(item.items, depth + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="w-60 bg-[#111319] border-r border-[#212430] flex flex-col h-full select-none">
      {/* Tab Switcher */}
      <div className="grid grid-cols-3 border-b border-[#1f222d] bg-[#0c0e14]">
        <button
          onClick={() => setLeftSidebarTab('pages')}
          className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            leftSidebarTab === 'pages'
              ? 'border-brand-purple text-purple-300 bg-[#141620]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          title="Page Thumbnails"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Pages</span>
        </button>

        <button
          onClick={() => setLeftSidebarTab('outline')}
          className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            leftSidebarTab === 'outline'
              ? 'border-brand-purple text-purple-300 bg-[#141620]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          title="Document Bookmarks / TOC"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Outline</span>
        </button>

        <button
          onClick={() => setLeftSidebarTab('layers')}
          className={`py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            leftSidebarTab === 'layers'
              ? 'border-brand-purple text-purple-300 bg-[#141620]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
          title="Page Layers & Objects"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Objects</span>
        </button>
      </div>

      {/* Tab 1: Pages List */}
      {leftSidebarTab === 'pages' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 border-b border-[#1f222d] flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500">
              {pages.length} Pages
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveModal('pages')}
                title="Manage & Reorder Pages"
                className="p-1 rounded hover:bg-[#1f222d] hover:text-white transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleAddBlankPage}
                title="Insert Blank Page After Current"
                className="p-1 rounded hover:bg-[#1f222d] hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {pages.map((p) => {
              const isActive = p.pageNumber === currentPage

              return (
                <div
                  key={p.pageNumber}
                  onClick={() => setCurrentPage(p.pageNumber)}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div
                    className={`w-full aspect-[1/1.414] bg-white rounded-lg overflow-hidden border-2 transition-all relative shadow-md flex items-center justify-center ${
                      isActive
                        ? 'border-brand-violet ring-2 ring-brand-violet/40 scale-[1.02]'
                        : 'border-[#232734] hover:border-slate-500 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {p.dataUrl ? (
                      <img
                        src={p.dataUrl}
                        alt={`Page ${p.pageNumber}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-slate-400 text-xs font-mono font-medium">
                        {p.pageNumber}
                      </div>
                    )}

                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-black/70 backdrop-blur-sm p-1 rounded-md">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          rotateCurrentPage(90)
                        }}
                        title="Rotate 90°"
                        className="p-1 hover:text-brand-violet text-white transition-colors"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      {pages.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePage(p.pageNumber)
                          }}
                          title="Delete Page"
                          className="p-1 hover:text-rose-400 text-white transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-xs mt-1.5 font-medium transition-colors ${
                      isActive ? 'text-brand-violet font-semibold' : 'text-slate-500'
                    }`}
                  >
                    Page {p.pageNumber}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Document Bookmarks / Outline */}
      {leftSidebarTab === 'outline' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 border-b border-[#1f222d] text-xs font-semibold uppercase tracking-wider text-slate-500">
            Table of Contents
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {outline.length > 0 ? (
              <div className="space-y-0.5">{renderOutlineItems(outline)}</div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">
                <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Dokumen ini tidak memiliki daftar isi atau bookmark tersemat.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Layers / Objects on Current Page */}
      {leftSidebarTab === 'layers' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 border-b border-[#1f222d] text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between items-center">
            <span>Page {currentPage} Objects</span>
            <span className="text-[10px] font-mono text-purple-400">
              {currentPageTexts.length + currentPageImages.length + currentPageAnnotations.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
            {/* Original Texts */}
            {currentPageTexts.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-slate-500 px-2 py-1 uppercase tracking-wider">
                  Text Elements ({currentPageTexts.length})
                </div>
                <div className="space-y-1">
                  {currentPageTexts.map((txt) => (
                    <div
                      key={txt.id}
                      onClick={() => {
                        setSelectedObject({ type: 'text', id: txt.id, data: txt })
                        setPropertiesOpen(true)
                      }}
                      className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#151722] hover:bg-[#1e2130] border border-[#232637] cursor-pointer text-slate-300 hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 pr-1">
                        <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">{txt.text || '(Empty text)'}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteOriginalText(txt.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                        title="Delete Text"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Original Images */}
            {currentPageImages.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-slate-500 px-2 py-1 uppercase tracking-wider">
                  Images ({currentPageImages.length})
                </div>
                <div className="space-y-1">
                  {currentPageImages.map((img, i) => (
                    <div
                      key={img.id}
                      onClick={() => {
                        setSelectedObject({ type: 'image', id: img.id, data: img })
                        setPropertiesOpen(true)
                      }}
                      className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#151722] hover:bg-[#1e2130] border border-[#232637] cursor-pointer text-slate-300 hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 pr-1">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">Image #{i + 1}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteOriginalImage(img.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                        title="Delete Image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Annotations & Redactions */}
            {currentPageAnnotations.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-slate-500 px-2 py-1 uppercase tracking-wider">
                  Annotations ({currentPageAnnotations.length})
                </div>
                <div className="space-y-1">
                  {currentPageAnnotations.map((ann, i) => (
                    <div
                      key={ann.id}
                      onClick={() => {
                        setSelectedObject({
                          type:
                            ann.type === 'text'
                              ? 'text'
                              : ann.type === 'image'
                                ? 'image'
                                : 'annotation',
                          id: ann.id,
                          data: ann,
                        })
                        setPropertiesOpen(true)
                      }}
                      className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#151722] hover:bg-[#1e2130] border border-[#232637] cursor-pointer text-slate-300 hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 pr-1">
                        {ann.type === 'redact' && (
                          <Shield className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        {ann.type === 'highlight' && (
                          <Highlighter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        {ann.type === 'signature' && (
                          <PenTool className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        )}
                        {ann.type === 'text' && (
                          <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        )}
                        {ann.type === 'comment' && (
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        {ann.type === 'image' && (
                          <ImageIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        )}
                        {ann.type === 'shape' && (
                          <Square className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                        <span className="truncate capitalize">
                          {ann.type === 'redact'
                            ? 'Redaction'
                            : ann.type === 'comment'
                              ? `Comment: ${ann.text || 'Note'}`
                              : ann.text || `${ann.type} #${i + 1}`}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeAnnotation(ann.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentPageTexts.length === 0 &&
              currentPageImages.length === 0 &&
              currentPageAnnotations.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">
                  <p>Tidak ada objek yang terdeteksi atau ditambahkan pada halaman ini.</p>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
