import React, { useRef, useState, useEffect } from 'react'
import { X, PenTool, RotateCcw, Check, Upload, Sparkles, MapPin } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'
import { DetectedSignatureSpot } from '@/types'

export const SignatureDialog: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    currentPage,
    addAnnotation,
    detectedSignatureSpots,
    activeSignatureSpot,
    setActiveSignatureSpot,
    savedSignature,
    setSavedSignature,
  } = usePdfStore()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [penColor, setPenColor] = useState('#0f172a') // Default black ink
  const [selectedSpot, setSelectedSpot] = useState<DetectedSignatureSpot | null>(null)

  useEffect(() => {
    if (activeModal === 'sign') {
      // If a spot was preselected or if spots exist on this page, default to first spot
      if (activeSignatureSpot) {
        setSelectedSpot(activeSignatureSpot)
      } else if (detectedSignatureSpots.length > 0) {
        setSelectedSpot(detectedSignatureSpots[0])
      } else {
        setSelectedSpot(null)
      }

      // If user has a saved signature, load it onto canvas
      if (savedSignature && canvasRef.current) {
        const img = new Image()
        img.onload = () => {
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          setHasDrawn(true)
        }
        img.src = savedSignature
      }
    }
  }, [activeModal, activeSignatureSpot, detectedSignatureSpots, savedSignature])

  useEffect(() => {
    if (activeModal === 'sign' && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 2.8
        ctx.strokeStyle = penColor
      }
    }
  }, [activeModal, penColor])

  if (activeModal !== 'sign') return null

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    setHasDrawn(true)

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
  }

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.strokeStyle = penColor
    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const handleApplySignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    const dataUrl = canvas.toDataURL('image/png')

    // Save signature for instant reuse
    setSavedSignature(dataUrl)

    // Calculate position: if spot is selected, snap to detected spot
    let targetX = 35
    let targetY = 70
    let targetW = 28
    let targetH = 10

    if (selectedSpot) {
      targetX = selectedSpot.x
      targetY = selectedSpot.y
      targetW = selectedSpot.width
      targetH = selectedSpot.height
    }

    addAnnotation({
      type: 'signature',
      pageNumber: currentPage,
      x: targetX,
      y: targetY,
      width: targetW,
      height: targetH,
      dataUrl,
    })

    setActiveSignatureSpot(null)
    setActiveModal(null)
  }

  const handleUploadImageSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      if (dataUrl) {
        setSavedSignature(dataUrl)
        let targetX = 35
        let targetY = 70
        let targetW = 28
        let targetH = 10

        if (selectedSpot) {
          targetX = selectedSpot.x
          targetY = selectedSpot.y
          targetW = selectedSpot.width
          targetH = selectedSpot.height
        }

        addAnnotation({
          type: 'signature',
          pageNumber: currentPage,
          x: targetX,
          y: targetY,
          width: targetW,
          height: targetH,
          dataUrl,
        })

        setActiveSignatureSpot(null)
        setActiveModal(null)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161f] border border-[#262a38] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#212432] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-inner">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Add Signature</h3>
              <p className="text-xs text-slate-400">Draw, upload or auto-detect signature spot</p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveSignatureSpot(null)
              setActiveModal(null)
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f222d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Automatic Signature Spot Detection Banner */}
          {detectedSignatureSpots.length > 0 && (
            <div className="bg-[#181c28] border border-cyan-500/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Deteksi Otomatis Kolom Tanda Tangan ({detectedSignatureSpots.length})</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Pilih kolom di bawah untuk menempatkan tanda tangan secara presisi:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {detectedSignatureSpots.map((spot) => (
                  <button
                    key={spot.id}
                    onClick={() => setSelectedSpot(spot)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      selectedSpot?.id === spot.id
                        ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                        : 'bg-[#202534] text-slate-300 hover:text-white hover:bg-[#282e42] border border-slate-700/50'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[200px]">{spot.label}</span>
                  </button>
                ))}
                <button
                  onClick={() => setSelectedSpot(null)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedSpot === null
                      ? 'bg-brand-violet text-white font-semibold'
                      : 'bg-[#202534] text-slate-400 hover:text-white'
                  }`}
                >
                  Posisi Bebas
                </button>
              </div>
            </div>
          )}

          {/* Controls: Color & Clear */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Ink Color:</span>
              <button
                onClick={() => setPenColor('#0f172a')}
                className={`w-5 h-5 rounded-full bg-slate-900 border border-slate-700 ${
                  penColor === '#0f172a' ? 'ring-2 ring-cyan-400' : ''
                }`}
                title="Black"
              />
              <button
                onClick={() => setPenColor('#1e40af')}
                className={`w-5 h-5 rounded-full bg-blue-800 ${
                  penColor === '#1e40af' ? 'ring-2 ring-cyan-400' : ''
                }`}
                title="Dark Blue"
              />
              <button
                onClick={() => setPenColor('#7c3aed')}
                className={`w-5 h-5 rounded-full bg-purple-600 ${
                  penColor === '#7c3aed' ? 'ring-2 ring-cyan-400' : ''
                }`}
                title="Purple"
              />
            </div>

            <button
              onClick={clearCanvas}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Pad
            </button>
          </div>

          {/* Drawing Canvas Pad */}
          <div className="border border-[#282c3c] bg-white rounded-xl overflow-hidden shadow-inner h-44 flex items-center justify-center relative">
            <canvas
              ref={canvasRef}
              width={460}
              height={175}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="cursor-crosshair w-full h-full"
            />
            {!hasDrawn && (
              <span className="absolute text-slate-400 text-xs pointer-events-none select-none">
                Draw signature here with mouse or stylus
              </span>
            )}
          </div>

          {/* Upload image signature option */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500">Or use a signature image:</span>
            <label className="text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              Upload Image (PNG/JPG)
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleUploadImageSignature}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#11131a] border-t border-[#212432] flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {selectedSpot ? (
              <span className="text-cyan-400 flex items-center gap-1 truncate max-w-xs">
                <Sparkles className="w-3 h-3 shrink-0" />
                Target: {selectedSpot.label}
              </span>
            ) : (
              <span>Posisi standar (Halaman {currentPage})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveSignatureSpot(null)
                setActiveModal(null)
              }}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-[#1a1c26] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplySignature}
              disabled={!hasDrawn}
              className="px-5 py-2 text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
              Place Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
