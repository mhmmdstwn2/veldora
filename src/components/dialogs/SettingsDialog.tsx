import React, { useEffect, useState } from 'react'
import { X, Settings, ShieldCheck, HardDrive, Info, RefreshCw, Download, CheckCircle2, AlertTriangle } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'

interface UpdaterState {
  status: string
  version?: string
  percent?: number
  message?: string
}

export const SettingsDialog: React.FC = () => {
  const { activeModal, setActiveModal } = usePdfStore()
  const [appVersion, setAppVersion] = useState('1.0.0')
  const [updater, setUpdater] = useState<UpdaterState>({ status: 'idle' })

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    api.getAppVersion?.().then((v) => v && setAppVersion(v))
    api.getUpdaterStatus?.().then((s) => s && setUpdater(s))
    const unsub = api.onUpdaterStatus?.((s) => setUpdater(s))
    return () => unsub?.()
  }, [activeModal])

  if (activeModal !== 'settings') return null

  const handleCheckUpdate = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      setUpdater({
        status: 'error',
        message: 'Auto-update hanya tersedia pada aplikasi desktop Windows (.exe).',
      })
      return
    }
    setUpdater({ status: 'checking', version: appVersion })
    await window.electronAPI.checkForUpdates()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161f] border border-[#262a38] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#212432] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Settings</h3>
              <p className="text-xs text-slate-400">Application preferences</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f222d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div className="bg-[#1a1c27] p-4 rounded-xl border border-[#272b3a] space-y-3">
            <div className="flex items-center gap-2 text-white font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Privacy & Local-First Processing
            </div>
            <p className="text-slate-400 leading-relaxed">
              VELDORA is built on a 100% Local-first architecture. All document rendering, annotations, compression, and conversions are computed locally. None of your sensitive data or PDF files are uploaded to any server.
            </p>
          </div>

          <div className="bg-[#1a1c27] p-4 rounded-xl border border-[#272b3a] space-y-2">
            <div className="flex items-center gap-2 text-white font-medium">
              <HardDrive className="w-4 h-4 text-brand-violet" />
              Storage & Cache
            </div>
            <p className="text-slate-400">
              Recent file metadata is saved locally on your device.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('veldora_recent_files')
                alert('Recent file history cleared.')
              }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-[#242838] hover:bg-[#30354a] text-slate-200 transition-colors"
            >
              Clear Recent Files History
            </button>
          </div>

          <div className="bg-[#1a1c27] p-4 rounded-xl border border-[#272b3a] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <Info className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-white">Version & Auto-Update</span>
              </div>
              <span className="font-mono text-slate-300 font-medium">v{appVersion}</span>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Sumber Update:</span>
              <span className="font-mono text-slate-300">GitHub (mhmmdstwn2/veldora)</span>
            </div>

            {updater.status === 'checking' && (
              <div className="flex items-center gap-2 text-blue-300 bg-blue-950/40 border border-blue-800/40 px-3 py-2 rounded-lg">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Memeriksa pembaruan di GitHub Releases...</span>
              </div>
            )}

            {updater.status === 'not-available' && (
              <div className="flex items-center gap-2 text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-3 py-2 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Aplikasi sudah menggunakan versi terbaru (v{appVersion}).</span>
              </div>
            )}

            {(updater.status === 'available' || updater.status === 'downloading') && (
              <div className="space-y-1.5 text-purple-200 bg-purple-950/40 border border-purple-800/40 px-3 py-2 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Download className="w-3.5 h-3.5 animate-bounce" />
                    Mengunduh v{updater.version}...
                  </span>
                  <span className="font-mono">{updater.percent ?? 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#202434] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-violet transition-all"
                    style={{ width: `${updater.percent ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {updater.status === 'downloaded' && (
              <div className="flex items-center justify-between gap-2 text-emerald-200 bg-emerald-950/50 border border-emerald-700/50 px-3 py-2 rounded-lg">
                <span>Update v{updater.version} siap dipasang!</span>
                <button
                  onClick={() => window.electronAPI?.installUpdate?.()}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-md transition-colors"
                >
                  Restart & Update
                </button>
              </div>
            )}

            {(updater.status === 'error' || updater.status === 'dev-mode') && updater.message && (
              <div className="flex items-start gap-2 text-amber-200 bg-amber-950/40 border border-amber-800/40 px-3 py-2 rounded-lg leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{updater.message}</span>
              </div>
            )}

            <button
              onClick={handleCheckUpdate}
              disabled={updater.status === 'checking' || updater.status === 'downloading'}
              className="w-full py-2 px-3 rounded-xl bg-[#242838] hover:bg-[#30354a] text-slate-200 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${updater.status === 'checking' ? 'animate-spin' : ''}`} />
              Cek Update Sekarang
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#11131a] border-t border-[#212432] flex items-center justify-end">
          <button
            onClick={() => setActiveModal(null)}
            className="px-5 py-2 text-xs font-semibold bg-brand-violet hover:bg-purple-600 text-white rounded-xl shadow-md transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

