import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, X, Sparkles } from 'lucide-react'

interface UpdaterStatus {
  status: string
  version?: string
  percent?: number
  message?: string
  manual?: boolean
}

export const UpdateBanner: React.FC = () => {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onUpdaterStatus) return

    api.getUpdaterStatus?.().then((s) => {
      if (s) setStatus(s)
    })

    const unsubscribe = api.onUpdaterStatus((next: UpdaterStatus) => {
      setStatus(next)
      if (next.status === 'downloaded' || next.status === 'downloading') {
        setDismissed(false)
      }
    })
    return () => unsubscribe?.()
  }, [])

  if (dismissed || !status) return null
  if (status.status !== 'downloading' && status.status !== 'downloaded') return null

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-[#141722]/95 backdrop-blur-md border border-brand-violet/50 rounded-2xl p-4 shadow-2xl text-xs text-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-violet/20 text-brand-violet flex items-center justify-center shrink-0">
            {status.status === 'downloaded' ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4 animate-bounce" />
            )}
          </div>
          <div>
            <p className="font-semibold text-white">
              {status.status === 'downloaded'
                ? `Update v${status.version || ''} Siap Dipasang`
                : `Mengunduh Update v${status.version || ''}`}
            </p>
            <p className="text-[11px] text-slate-400">
              {status.status === 'downloaded'
                ? 'Restart aplikasi untuk menggunakan versi terbaru.'
                : `Progres unduhan: ${status.percent ?? 0}%`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1e2230]"
          title="Tutup notifikasi"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {status.status === 'downloading' && (
        <div className="mt-3 w-full h-1.5 bg-[#202434] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-purple to-brand-violet transition-all duration-200"
            style={{ width: `${status.percent ?? 0}%` }}
          />
        </div>
      )}

      {status.status === 'downloaded' && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e2230] transition-colors"
          >
            Nanti
          </button>
          <button
            onClick={() => window.electronAPI?.installUpdate?.()}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-violet hover:from-brand-violet hover:to-purple-500 text-white font-semibold flex items-center gap-1.5 shadow-md transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restart & Update
          </button>
        </div>
      )}
    </div>
  )
}
