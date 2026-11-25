import React from 'react'
import {
  RotateCw,
  Highlighter,
  Type,
  Plus,
  Trash2,
  PenTool,
  MessageSquare,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'

export const FloatingPageTools: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    rotateCurrentPage,
    currentPage,
    pages,
    currentDoc,
    insertBlankPage,
    deletePageFromDoc,
    setActiveModal,
  } = usePdfStore()

  const handleInsertPage = async () => {
    if (!currentDoc) return
    await insertBlankPage(currentPage)
  }

  const handleDeletePage = async () => {
    if (!currentDoc || pages.length <= 1) return
    if (confirm(`Delete page ${currentPage}?`)) {
      await deletePageFromDoc(currentPage)
    }
  }

  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 hidden md:flex flex-col items-center gap-1.5 p-1.5 bg-[#171922]/90 backdrop-blur-md border border-[#2b2e3d] rounded-2xl shadow-2xl">
      <button
        onClick={() => setActiveTool(activeTool === 'highlight' ? 'select' : 'highlight')}
        title="Highlighter"
        className={`p-2 rounded-xl transition-colors ${
          activeTool === 'highlight'
            ? 'bg-brand-violet text-white'
            : 'text-slate-400 hover:text-white hover:bg-[#252836]'
        }`}
      >
        <Highlighter className="w-4 h-4" />
      </button>

      <button
        onClick={() => setActiveTool(activeTool === 'text' ? 'select' : 'text')}
        title="Add Text"
        className={`p-2 rounded-xl transition-colors ${
          activeTool === 'text'
            ? 'bg-brand-violet text-white'
            : 'text-slate-400 hover:text-white hover:bg-[#252836]'
        }`}
      >
        <Type className="w-4 h-4" />
      </button>

      <button
        onClick={() => setActiveTool(activeTool === 'comment' ? 'select' : 'comment')}
        title="Add Comment Note"
        className={`p-2 rounded-xl transition-colors ${
          activeTool === 'comment'
            ? 'bg-amber-600 text-white'
            : 'text-slate-400 hover:text-amber-300 hover:bg-[#252836]'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
      </button>

      <button
        onClick={() => {
          setActiveTool('sign')
          setActiveModal('sign')
        }}
        title="Sign"
        className={`p-2 rounded-xl transition-colors ${
          activeTool === 'sign'
            ? 'bg-brand-violet text-white'
            : 'text-slate-400 hover:text-white hover:bg-[#252836]'
        }`}
      >
        <PenTool className="w-4 h-4" />
      </button>

      <div className="w-5 h-px bg-[#2b2e3d] my-1" />

      <button
        onClick={() => rotateCurrentPage(90)}
        title="Rotate Page"
        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#252836] transition-colors"
      >
        <RotateCw className="w-4 h-4" />
      </button>

      <button
        onClick={handleInsertPage}
        title="Insert Blank Page"
        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#252836] transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>

      {pages.length > 1 && (
        <button
          onClick={handleDeletePage}
          title="Delete Page"
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-[#252836] transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
