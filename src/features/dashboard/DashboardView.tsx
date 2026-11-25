import React, { useEffect, useState } from 'react'
import {
  Scissors,
  Files,
  PlusSquare,
  Trash2,
  Minimize2,
  PenTool,
  RefreshCw,
  Edit3,
  Highlighter,
  MessageSquare,
  Image as ImageIcon,
  Upload,
  FileText,
  Clock,
  HardDrive,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Stamp,
  Hash,
  Shield,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { ToolType } from '@/types'

interface DashboardViewProps {
  onOpenEditor: () => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onOpenEditor }) => {
  const {
    openFileWithPicker,
    loadDocumentFromData,
    recentFiles,
    loadRecentFiles,
    setActiveModal,
    setActiveTool,
    currentDoc,
  } = usePdfStore()

  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    loadRecentFiles()
  }, [loadRecentFiles])

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const buffer = await file.arrayBuffer()
        await loadDocumentFromData(new Uint8Array(buffer), file.name)
        onOpenEditor()
      }
    }
  }

  const handleToolClick = (modalType: string | null, toolType?: ToolType) => {
    if (!currentDoc) {
      openFileWithPicker().then(() => {
        if (toolType) setActiveTool(toolType)
        if (modalType) setActiveModal(modalType)
        onOpenEditor()
      })
      return
    }

    if (toolType) setActiveTool(toolType)
    if (modalType) setActiveModal(modalType)
    onOpenEditor()
  }

  const tools = [
    {
      id: 'edit-text',
      label: 'Edit Text',
      desc: 'Select and edit existing text content directly from PDF pages',
      icon: Edit3,
      modal: null,
      tool: 'edit-text' as ToolType,
      color: 'from-blue-600/20 to-sky-500/10 text-blue-400',
    },
    {
      id: 'ocr',
      label: 'OCR PDF',
      desc: 'Convert scanned PDF pages and images to searchable/editable text',
      icon: Sparkles,
      modal: 'ocr',
      tool: 'ocr' as ToolType,
      color: 'from-amber-500/20 to-yellow-500/10 text-amber-300',
    },
    {
      id: 'redact',
      label: 'Redact',
      desc: 'Permanently remove and censor confidential content from the PDF',
      icon: Shield,
      modal: null,
      tool: 'redact' as ToolType,
      color: 'from-red-500/20 to-rose-500/10 text-red-400',
    },
    {
      id: 'watermark',
      label: 'Watermark',
      desc: 'Add custom security text watermarks with angle and opacity control',
      icon: Stamp,
      modal: 'watermark',
      tool: 'watermark' as ToolType,
      color: 'from-purple-500/20 to-fuchsia-500/10 text-purple-400',
    },
    {
      id: 'page-number',
      label: 'Page Numbers',
      desc: 'Insert customizable header and footer page numbering',
      icon: Hash,
      modal: 'page-number',
      tool: 'page-number' as ToolType,
      color: 'from-cyan-500/20 to-teal-500/10 text-cyan-400',
    },
    {
      id: 'protect',
      label: 'Protect',
      desc: 'Secure PDF with passwords, encryption, and permission flags',
      icon: ShieldCheck,
      modal: 'security',
      tool: 'select' as ToolType,
      color: 'from-emerald-500/20 to-green-500/10 text-emerald-400',
    },
    {
      id: 'split',
      label: 'Split',
      desc: 'Separate pages or extract ranges into distinct files',
      icon: Scissors,
      modal: 'split',
      tool: 'split' as ToolType,
      color: 'from-blue-500/20 to-indigo-500/10 text-blue-400',
    },
    {
      id: 'merge',
      label: 'Merge',
      desc: 'Combine multiple PDF documents in custom order',
      icon: Files,
      modal: 'merge',
      tool: 'merge' as ToolType,
      color: 'from-violet-500/20 to-purple-500/10 text-violet-400',
    },
    {
      id: 'insert',
      label: 'Insert',
      desc: 'Insert blank pages or append pages from other files',
      icon: PlusSquare,
      modal: 'pages',
      tool: 'insert' as ToolType,
      color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400',
    },
    {
      id: 'delete',
      label: 'Delete',
      desc: 'Remove unwanted pages with quick single or batch delete',
      icon: Trash2,
      modal: 'pages',
      tool: 'delete' as ToolType,
      color: 'from-rose-500/20 to-red-500/10 text-rose-400',
    },
    {
      id: 'compress',
      label: 'Compress',
      desc: 'Optimize file size with configurable quality levels',
      icon: Minimize2,
      modal: 'compress',
      tool: 'compress' as ToolType,
      color: 'from-amber-500/20 to-yellow-500/10 text-amber-400',
    },
    {
      id: 'sign',
      label: 'Sign',
      desc: 'Create or upload visual signatures and stamp documents',
      icon: PenTool,
      modal: 'sign',
      tool: 'sign' as ToolType,
      color: 'from-cyan-500/20 to-sky-500/10 text-cyan-400',
    },
    {
      id: 'convert',
      label: 'Convert',
      desc: 'Export pages to PNG/JPG or build PDFs from images',
      icon: RefreshCw,
      modal: 'convert',
      tool: 'convert' as ToolType,
      color: 'from-fuchsia-500/20 to-pink-500/10 text-fuchsia-400',
    },
    {
      id: 'edit',
      label: 'Edit PDF',
      desc: 'Add custom text, customize typography, colors & shapes',
      icon: Edit3,
      modal: null,
      tool: 'text' as ToolType,
      color: 'from-indigo-500/20 to-blue-500/10 text-indigo-400',
    },
    {
      id: 'highlight',
      label: 'Highlight',
      desc: 'Highlight important lines & paragraphs with colors',
      icon: Highlighter,
      modal: null,
      tool: 'highlight' as ToolType,
      color: 'from-yellow-500/20 to-amber-500/10 text-yellow-400',
    },
    {
      id: 'comment',
      label: 'Comment',
      desc: 'Add annotations, notes and comments on any page',
      icon: MessageSquare,
      modal: null,
      tool: 'comment' as ToolType,
      color: 'from-purple-500/20 to-violet-500/10 text-purple-400',
    },
    {
      id: 'image',
      label: 'Add Image',
      desc: 'Insert logos, stamps, PNG and JPG graphics into pages',
      icon: ImageIcon,
      modal: 'image',
      tool: 'image' as ToolType,
      color: 'from-teal-500/20 to-emerald-500/10 text-teal-400',
    },
  ]

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="flex-1 bg-[#0f1115] overflow-y-auto p-8 text-slate-200">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Dashboard
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Select a tool below or open a PDF to start editing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await openFileWithPicker()
                onOpenEditor()
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-brand-purple to-brand-violet hover:from-brand-violet hover:to-purple-500 text-white shadow-lg shadow-brand-purple/25 hover:shadow-brand-purple/40 transition-all duration-200"
            >
              <Upload className="w-4 h-4" />
              Open Document
            </button>

            {currentDoc && (
              <button
                onClick={onOpenEditor}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-[#1c1f28] hover:bg-[#252936] text-slate-200 border border-slate-700/60 transition-colors"
              >
                Return to Editor
                <ArrowRight className="w-4 h-4 text-brand-violet" />
              </button>
            )}
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={async () => {
            await openFileWithPicker()
            onOpenEditor()
          }}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-brand-violet bg-brand-violet/10 scale-[1.005]'
              : 'border-[#262a36] hover:border-slate-600 bg-[#14161d]/60 hover:bg-[#161822]'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#1d202b] flex items-center justify-center text-brand-violet shadow-inner">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <p className="font-semibold text-white text-base">
                Drop your PDF file here, or{' '}
                <span className="text-brand-violet hover:underline">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports all standard PDF documents. Processed 100% locally on your machine.
              </p>
            </div>
          </div>
        </div>

        {/* PDF Tools Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              PDF Tools
            </h3>
            <span className="text-xs text-slate-500">11 Tools Available</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.modal, tool.tool)}
                  className="flex flex-col items-start p-4 rounded-xl bg-[#15171e] hover:bg-[#1b1e28] border border-[#20232d] hover:border-[#323647] transition-all duration-200 text-left group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40"
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-sm text-slate-100 group-hover:text-white">
                    {tool.label}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {tool.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Recent Documents & Privacy Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Recent Documents */}
          <div className="lg:col-span-2 bg-[#14161d] border border-[#20232d] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-violet" />
                <h4 className="font-semibold text-sm text-white">Recent Documents</h4>
              </div>
              <span className="text-xs text-slate-500">{recentFiles.length} files</span>
            </div>

            {recentFiles.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No recent documents yet. Open a document to get started.
              </div>
            ) : (
              <div className="divide-y divide-[#1e212b]">
                {recentFiles.slice(0, 5).map((file) => (
                  <div
                    key={file.id}
                    className="py-3 flex items-center justify-between hover:bg-[#1b1d26] px-2 rounded-lg transition-colors cursor-pointer group"
                    onClick={async () => {
                      if (file.path && window.electronAPI) {
                        // Desktop fast open
                      } else {
                        await openFileWithPicker()
                        onOpenEditor()
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-800/30 flex items-center justify-center text-red-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-slate-200 truncate group-hover:text-brand-violet">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {file.pageCount} pages • {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>

                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(file.lastOpened).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy & System Status */}
          <div className="bg-[#14161d] border border-[#20232d] rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-950/50 border border-emerald-600/30 flex items-center justify-center text-emerald-400 mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-sm text-white mb-1">
                Local-First Architecture
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Your PDF documents never leave this device. All processing, conversion, signing, and editing happens entirely offline in your browser/desktop runtime.
              </p>
            </div>

            <div className="pt-3 border-t border-[#1e212b] flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                Offline Storage
              </span>
              <span className="text-emerald-400 font-medium">Secured</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

