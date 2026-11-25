import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
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
  ShieldCheck,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { ToolType } from '@/types'

interface SidebarProps {
  currentView: 'dashboard' | 'editor'
  onNavigate: (view: 'dashboard' | 'editor') => void
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { currentDoc, openFileWithPicker, setActiveModal, setActiveTool } = usePdfStore()
  const [appVersion, setAppVersion] = useState('1.0.0')

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then((v) => v && setAppVersion(v))
  }, [])

  const handleToolClick = (modalType: string | null, toolType?: ToolType) => {
    if (!currentDoc) {
      // If no doc is open, prompt user to open one
      openFileWithPicker().then(() => {
        if (toolType) setActiveTool(toolType)
        if (modalType) setActiveModal(modalType)
        onNavigate('editor')
      })
      return
    }

    if (toolType) setActiveTool(toolType)
    if (modalType) setActiveModal(modalType)
    onNavigate('editor')
  }

  const pdfTools = [
    { id: 'split', label: 'Split', icon: Scissors, modal: 'split', tool: 'split' as ToolType },
    { id: 'merge', label: 'Merge', icon: Files, modal: 'merge', tool: 'merge' as ToolType },
    { id: 'insert', label: 'Insert', icon: PlusSquare, modal: 'pages', tool: 'insert' as ToolType },
    { id: 'delete', label: 'Delete', icon: Trash2, modal: 'pages', tool: 'delete' as ToolType },
    { id: 'compress', label: 'Compress', icon: Minimize2, modal: 'compress', tool: 'compress' as ToolType },
    { id: 'sign', label: 'Sign', icon: PenTool, modal: 'sign', tool: 'sign' as ToolType },
    { id: 'convert', label: 'Convert', icon: RefreshCw, modal: 'convert', tool: 'convert' as ToolType },
    { id: 'edit', label: 'Edit PDF', icon: Edit3, modal: null, tool: 'text' as ToolType },
    { id: 'highlight', label: 'Highlight', icon: Highlighter, modal: null, tool: 'highlight' as ToolType },
    { id: 'comment', label: 'Comment', icon: MessageSquare, modal: null, tool: 'comment' as ToolType },
    { id: 'image', label: 'Add Image', icon: ImageIcon, modal: 'image', tool: 'image' as ToolType },
  ]

  return (
    <aside className="w-64 bg-[#0c0d10] border-r border-[#1e2029] flex flex-col h-screen select-none text-slate-300">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-[#1a1c24]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-purple to-brand-violet flex items-center justify-center text-white shadow-lg shadow-brand-purple/20">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <path d="m10 13-2 2 2 2"></path>
              <path d="m14 17 2-2-2-2"></path>
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-base text-white tracking-wide">VELDORA</h1>
            <p className="text-[10px] text-slate-500 uppercase font-medium tracking-wider">PDF Studio</p>
          </div>
        </div>

        {/* Local-first Badge */}
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/70 border border-emerald-600/30 text-emerald-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          Local-first
        </span>
      </div>

      {/* Main Navigation */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            currentView === 'dashboard'
              ? 'bg-[#1c1f28] text-white shadow-sm border border-slate-700/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#15171e]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-brand-violet" />
          Dashboard
        </button>

        <button
          onClick={openFileWithPicker}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-[#15171e] transition-colors"
        >
          <FolderOpen className="w-4 h-4 text-blue-400" />
          Open PDF...
        </button>
      </div>

      {/* PDF Tools Section */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          PDF Tools
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {pdfTools.map((tool) => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.modal, tool.tool)}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-[#171922] transition-colors text-left group"
            >
              <Icon className="w-4 h-4 text-slate-400 group-hover:text-brand-violet transition-colors" />
              <span>{tool.label}</span>
            </button>
          )
        })}
      </div>

      {/* Footer / Settings */}
      <div className="p-3 border-t border-[#1a1c24] flex items-center justify-between">
        <button
          onClick={() => setActiveModal('settings')}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-[#15171e] transition-colors"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </button>

        <span className="text-[11px] text-slate-600 font-mono">v{appVersion}</span>
      </div>
    </aside>
  )
}
