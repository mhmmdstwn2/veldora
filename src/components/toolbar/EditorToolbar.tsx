import React from 'react'
import {
  MousePointer,
  Edit3,
  Image as ImageIcon,
  Type,
  Eraser,
  Highlighter,
  MessageSquare,
  Shield,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  PenTool,
  Sparkles,
  SlidersHorizontal,
  Stamp,
  Hash,
  Crop,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'

export const EditorToolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    color,
    setColor,
    fontSize,
    setFontSize,
    setActiveModal,
    clearAnnotations,
    annotations,
    detectedSignatureSpots,
    isPropertiesOpen,
    setPropertiesOpen,
  } = usePdfStore()

  const colors = [
    { label: 'Dark', value: '#0f172a' },
    { label: 'Yellow', value: '#fbbf24' },
    { label: 'Green', value: '#10b981' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Violet', value: '#8b5cf6' },
    { label: 'Red', value: '#ef4444' },
  ]

  const fontSizes = [10, 11, 12, 14, 16, 18, 20, 24, 32]

  return (
    <div className="h-12 bg-[#14161d] border-b border-[#212430] px-3 flex items-center justify-between select-none overflow-x-auto gap-2">
      {/* Primary Tool Strip */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Select Tool */}
        <button
          onClick={() => setActiveTool('select')}
          title="Select & Move (V)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'select'
              ? 'bg-brand-violet text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Select</span>
        </button>

        <div className="h-4 w-px bg-[#262a38] mx-1" />

        {/* Real Content Editing Tools */}
        <button
          onClick={() => setActiveTool('edit-text')}
          title="Edit Original PDF Text: Select and modify existing text directly in the document"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'edit-text'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
          <span>Edit Text</span>
        </button>

        <button
          onClick={() => setActiveTool('edit-image')}
          title="Edit Original PDF Images: Select, move, resize, or replace embedded images"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'edit-image'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>Edit Image</span>
        </button>

        {/* OCR Engine Button */}
        <button
          onClick={() => setActiveModal('ocr')}
          title="OCR: Convert scanned PDFs & images to searchable/editable text with Indonesian & English support"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>OCR</span>
        </button>

        <div className="h-4 w-px bg-[#262a38] mx-1" />

        {/* Annotate & Insert Tools */}
        <button
          onClick={() => setActiveTool('text')}
          title="Add New Text"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'text'
              ? 'bg-brand-violet text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Add Text</span>
        </button>

        <button
          onClick={() => setActiveTool('whiteout')}
          title="Whiteout & Overwrite"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'whiteout'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <Eraser className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Whiteout</span>
        </button>

        <button
          onClick={() => setActiveTool('highlight')}
          title="Highlight Text / Area"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'highlight'
              ? 'bg-brand-violet text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Highlight</span>
        </button>

        <button
          onClick={() => setActiveTool('comment')}
          title="Add Comment / Sticky Note"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'comment'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-amber-300 hover:bg-[#1f222d]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Comment</span>
        </button>

        {/* Permanent Redaction */}
        <button
          onClick={() => setActiveTool('redact')}
          title="True PDF Redaction: Permanently censor and erase sensitive text/areas from the PDF vector stream"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'redact'
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-red-400" />
          <span className="hidden md:inline">Redact</span>
        </button>

        {/* Shapes Group */}
        <div className="flex items-center bg-[#1a1c26] rounded-lg p-0.5 border border-[#252838]">
          <button
            onClick={() => setActiveTool('rect')}
            title="Rectangle"
            className={`p-1.5 rounded-md transition-colors ${
              activeTool === 'rect' ? 'bg-brand-violet text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('circle')}
            title="Circle"
            className={`p-1.5 rounded-md transition-colors ${
              activeTool === 'circle' ? 'bg-brand-violet text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('line')}
            title="Line"
            className={`p-1.5 rounded-md transition-colors ${
              activeTool === 'line' ? 'bg-brand-violet text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTool('arrow')}
            title="Arrow"
            className={`p-1.5 rounded-md transition-colors ${
              activeTool === 'arrow' ? 'bg-brand-violet text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MoveUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-[#262a38] mx-1" />

        {/* Signature Tool */}
        <button
          onClick={() => {
            setActiveTool('sign')
            setActiveModal('sign')
          }}
          title={
            detectedSignatureSpots.length > 0
              ? `${detectedSignatureSpots.length} signature spot(s) auto-detected on this page!`
              : 'Sign Document'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'sign'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Sign</span>
          {detectedSignatureSpots.length > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
              {detectedSignatureSpots.length}
            </span>
          )}
        </button>

        {/* Add Image */}
        <button
          onClick={() => {
            setActiveTool('image')
            setActiveModal('image')
          }}
          title="Insert New Image"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTool === 'image'
              ? 'bg-brand-violet text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Image</span>
        </button>
      </div>

      {/* Secondary Controls: Document Enhancements & Properties */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Document Enhancements Dropdowns / Dialog triggers */}
        <div className="hidden xl:flex items-center gap-1">
          <button
            onClick={() => setActiveModal('watermark')}
            title="Add Document Watermark"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1f222d] transition-colors"
          >
            <Stamp className="w-3.5 h-3.5 text-purple-400" />
            <span>Watermark</span>
          </button>

          <button
            onClick={() => setActiveModal('page-number')}
            title="Header & Footer Page Numbers"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1f222d] transition-colors"
          >
            <Hash className="w-3.5 h-3.5 text-blue-400" />
            <span>Page #</span>
          </button>

          <button
            onClick={() => setActiveModal('crop')}
            title="Crop Page Boundaries"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1f222d] transition-colors"
          >
            <Crop className="w-3.5 h-3.5 text-amber-400" />
            <span>Crop</span>
          </button>

          <button
            onClick={() => setActiveModal('security')}
            title="Protect PDF with Password & Permissions"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#1f222d] transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Protect</span>
          </button>
        </div>

        {/* Color Palette */}
        <div className="hidden md:flex items-center gap-1.5 ml-1">
          {colors.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              title={c.label}
              className={`w-4 h-4 rounded-full transition-transform ${
                color === c.value
                  ? 'ring-2 ring-white scale-110 shadow-sm'
                  : 'hover:scale-105 opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        {/* Font Size Selector if text/whiteout active */}
        {(activeTool === 'text' || activeTool === 'whiteout') && (
          <div className="flex items-center gap-1 bg-[#1a1c26] border border-[#252838] rounded-lg px-2 py-0.5 text-xs">
            <span className="text-slate-500">Size:</span>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              {fontSizes.map((s) => (
                <option key={s} value={s} className="bg-[#14161d]">
                  {s}pt
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Clear annotations */}
        {annotations.length > 0 && (
          <button
            onClick={clearAnnotations}
            title="Clear all annotations on document"
            className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}

        <div className="h-4 w-px bg-[#262a38] mx-1" />

        {/* Right Properties Panel Toggle Button */}
        <button
          onClick={() => setPropertiesOpen(!isPropertiesOpen)}
          title={isPropertiesOpen ? 'Hide Properties Panel' : 'Show Properties Panel'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isPropertiesOpen
              ? 'bg-brand-purple/20 text-purple-300 border border-brand-purple/40'
              : 'text-slate-400 hover:text-white hover:bg-[#1f222d]'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Properties</span>
        </button>
      </div>
    </div>
  )
}
