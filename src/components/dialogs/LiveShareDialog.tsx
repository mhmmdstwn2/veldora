import React, { useEffect, useState } from 'react'
import {
  X,
  Radio,
  Users,
  Copy,
  Check,
  Wifi,
  ShieldAlert,
  Send,
  RefreshCw,
  LogOut,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'

interface HostStatus {
  isHosting: boolean
  pairId: string | null
  ip: string | null
  port: number | null
  pin: string | null
  docName: string | null
  clientCount: number
  version: number
}

interface DiscoveredHost {
  pairId: string
  hostName: string
  docName: string
  ip: string
  port: number
}

export const LiveShareDialog: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    currentDoc,
    syncToReview,
    setReviewDocBytes,
    setEditorMode,
    showToast,
  } = usePdfStore()

  const isOpen = activeModal === 'live-share'
  const [tab, setTab] = useState<'host' | 'join'>('host')
  const [hostStatus, setHostStatus] = useState<HostStatus>({
    isHosting: false,
    pairId: null,
    ip: null,
    port: null,
    pin: null,
    docName: null,
    clientCount: 0,
    version: 0,
  })
  const [isStartingHost, setIsStartingHost] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedTutorial, setCopiedTutorial] = useState(false)
  const [pairIdInput, setPairIdInput] = useState('')
  const [discovered, setDiscovered] = useState<DiscoveredHost[]>([])
  const [isJoining, setIsJoining] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [joinedDocName, setJoinedDocName] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const api = (window as any)?.electronAPI

  useEffect(() => {
    if (!api) return
    api.liveShareGetHostStatus?.().then((s: HostStatus) => {
      if (s) setHostStatus(s)
    })
    const offHost = api.onLiveShareHostStatus?.((s: HostStatus) => {
      setHostStatus(s)
    })
    const offClient = api.onLiveShareClientStatus?.((s: { isJoined: boolean; docName?: string }) => {
      setIsJoined(Boolean(s?.isJoined))
      setJoinedDocName(s?.docName || null)
    })
    const offDisc = api.onLiveShareDiscovered?.((list: DiscoveredHost[]) => {
      setDiscovered(list || [])
    })
    return () => {
      offHost?.()
      offClient?.()
      offDisc?.()
    }
  }, [api])

  useEffect(() => {
    if (!isOpen || !api) return
    setErrorMsg(null)
    if (tab === 'join') {
      api.liveShareStartDiscovery?.().then((list: DiscoveredHost[]) => {
        if (Array.isArray(list)) setDiscovered(list)
      })
      return () => {
        api.liveShareStopDiscovery?.()
      }
    }
  }, [isOpen, tab, api])

  if (!isOpen) return null

  const handleStartHost = async () => {
    if (!api?.liveShareStartHost) {
      setErrorMsg('Fitur Live Share hanya tersedia di aplikasi desktop VELDORA.')
      return
    }
    setErrorMsg(null)
    setIsStartingHost(true)
    try {
      const bytes = await syncToReview()
      if (!bytes) {
        setErrorMsg('Buka dokumen PDF terlebih dahulu sebelum membagikan sesi live.')
        return
      }
      const status = await api.liveShareStartHost(bytes, currentDoc?.name || 'document.pdf')
      setHostStatus(status)
      showToast('Live Review aktif! Bagikan Pair ID ke rekan Anda.')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memulai server Live Review.')
    } finally {
      setIsStartingHost(false)
    }
  }

  const handleStopHost = async () => {
    await api?.liveShareStopHost?.()
    showToast('Sesi Live Review dihentikan.')
  }

  const handleCopyPairId = async () => {
    if (!hostStatus.pairId) return
    await navigator.clipboard.writeText(hostStatus.pairId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const handleCopyTutorialMessage = async () => {
    if (!hostStatus.pairId) return
    const msg = [
      `📄 *Undangan Live Review PDF (VELDORA)*`,
      `Dokumen: ${hostStatus.docName || 'PDF'}`,
      `Pair ID: *${hostStatus.pairId}*`,
      ``,
      `Cara bergabung:`,
      `1. Pastikan laptop terhubung di Wi-Fi / LAN yang sama.`,
      `2. Buka aplikasi *VELDORA*, klik tombol *Share Live* di atas.`,
      `3. Pilih tab *Join Live Review*, lalu masukkan Pair ID: *${hostStatus.pairId}* dan klik *Gabung*.`,
    ].join('\n')
    await navigator.clipboard.writeText(msg)
    setCopiedTutorial(true)
    setTimeout(() => setCopiedTutorial(false), 2500)
  }

  const handleJoin = async (targetPairId?: string) => {
    const code = (targetPairId || pairIdInput).trim()
    if (!code) {
      setErrorMsg('Masukkan Pair ID terlebih dahulu.')
      return
    }
    if (!api?.liveShareJoin) {
      setErrorMsg('Fitur Live Share hanya tersedia di aplikasi desktop VELDORA.')
      return
    }
    setErrorMsg(null)
    setIsJoining(true)
    try {
      const res = await api.liveShareJoin(code)
      if (res?.pdfBytes) {
        setReviewDocBytes(new Uint8Array(res.pdfBytes), res.docName)
        setEditorMode('review')
        setIsJoined(true)
        setJoinedDocName(res.docName)
        showToast(`Terhubung ke Live Review: ${res.docName}`)
        setActiveModal(null)
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Gagal terhubung. Pastikan satu Wi-Fi/LAN dan Pair ID benar.'
      )
    } finally {
      setIsJoining(false)
    }
  }

  const handleLeave = async () => {
    await api?.liveShareLeave?.()
    setIsJoined(false)
    setJoinedDocName(null)
    showToast('Keluar dari sesi Live Review.')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#12141c] border border-[#262a3a] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222636] bg-[#161923]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Share Live Form & Review (LAN / Wi-Fi)
              </h2>
              <p className="text-[11px] text-slate-400">
                Bagikan POV pembaca secara real-time ke pengguna VELDORA lain
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#232736]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-1.5 bg-[#0f1118] border-b border-[#222636] gap-1">
          <button
            onClick={() => setTab('host')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              tab === 'host'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-[#191c27]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Bagikan PDF Saya (Host)
          </button>
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              tab === 'join'
                ? 'bg-brand-violet text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-[#191c27]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Gabung Live Review
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-700/60 text-rose-200 text-xs">
              {errorMsg}
            </div>
          )}

          {tab === 'host' ? (
            <>
              {!hostStatus.isHosting ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#181b25] border border-[#272b3d] space-y-2">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Klik tombol di bawah untuk membuat{' '}
                      <span className="text-white font-semibold">Pair ID otomatis</span>.
                      Setiap kali Anda menekan{' '}
                      <kbd className="px-1.5 py-0.5 bg-[#0c0e14] border border-[#2d3245] rounded text-[10px] text-emerald-300 font-mono">
                        Ctrl + S
                      </kbd>{' '}
                      di Mode Edit Konten, tampilan{' '}
                      <span className="text-emerald-400 font-medium">Form & Review</span>{' '}
                      di laptop teman akan ikut ter-update secara live.
                    </p>
                  </div>

                  <button
                    onClick={handleStartHost}
                    disabled={isStartingHost || !currentDoc}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    {isStartingHost ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Membuat Pair ID...
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4" />
                        Mulai Share Live PDF to Review
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Pair ID Box */}
                  <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Live Aktif • {hostStatus.clientCount} Pembaca Terhubung
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        v{hostStatus.version}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#0b0d13] border border-[#2a3044] rounded-lg px-3 py-2.5 font-mono text-sm font-bold text-white tracking-wider select-all">
                        {hostStatus.pairId}
                      </div>
                      <button
                        onClick={handleCopyPairId}
                        className="px-3 py-2.5 rounded-lg bg-[#1d2230] hover:bg-[#272d3f] border border-[#32384e] text-xs font-medium text-white flex items-center gap-1.5"
                      >
                        {copiedId ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Disalin
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Salin ID
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => syncToReview()}
                        className="flex-1 py-2 px-3 rounded-lg bg-[#1b202d] hover:bg-[#242a3b] border border-[#2d3347] text-xs font-medium text-slate-200 flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                        Kirim Update Sekarang (Ctrl+S)
                      </button>
                      <button
                        onClick={handleStopHost}
                        className="py-2 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-xs font-medium text-rose-300 flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Stop
                      </button>
                    </div>
                  </div>

                  {/* Built-in Tutorial */}
                  <div className="p-4 rounded-xl bg-[#161923] border border-[#25293a] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">
                        Tutorial untuk Penerima (Rekan Kerja)
                      </h4>
                      <button
                        onClick={handleCopyTutorialMessage}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                      >
                        {copiedTutorial ? (
                          <>
                            <Check className="w-3 h-3" /> Pesan Tersalin!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> Salin Pesan + Tutorial
                          </>
                        )}
                      </button>
                    </div>
                    <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>
                        Pastikan laptop penerima terhubung di{' '}
                        <span className="text-white font-medium">Wi-Fi / LAN yang sama</span>.
                      </li>
                      <li>
                        Buka aplikasi <span className="text-white font-medium">VELDORA</span>,
                        klik tombol <span className="text-emerald-400 font-medium">Share Live</span>{' '}
                        di bagian atas.
                      </li>
                      <li>
                        Pilih tab <span className="text-white font-medium">Join Live Review</span>,
                        lalu klik sesi yang muncul atau tempel Pair ID{' '}
                        <span className="font-mono text-emerald-300">{hostStatus.pairId}</span>.
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Windows Firewall Notice */}
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  <span className="font-semibold text-amber-300">Catatan Windows Firewall:</span>{' '}
                  Saat pertama kali menjalankan Share Live, jika muncul popup{' '}
                  <em>Windows Security Alert</em>, centang <strong>Private networks</strong> lalu
                  klik <strong>Allow access</strong> agar laptop teman dapat terhubung.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {isJoined && (
                <div className="p-3.5 rounded-xl bg-brand-violet/15 border border-brand-violet/40 flex items-center justify-between">
                  <div className="text-xs">
                    <p className="font-semibold text-white">Sedang Mengikuti Live Review</p>
                    <p className="text-slate-300 text-[11px]">{joinedDocName}</p>
                  </div>
                  <button
                    onClick={handleLeave}
                    className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-medium"
                  >
                    Keluar
                  </button>
                </div>
              )}

              {/* Auto-discovered LAN sessions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    Sesi Aktif di Wi-Fi / LAN Ini
                  </span>
                  <span className="text-[11px] text-slate-500">Auto-detect</span>
                </div>

                {discovered.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#161923] border border-[#242838] text-[11px] text-slate-400 text-center">
                    Belum ada sesi terdeteksi otomatis. Anda tetap bisa memasukkan Pair ID secara
                    manual di bawah.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {discovered.map((h) => (
                      <div
                        key={h.pairId}
                        className="p-3 rounded-xl bg-[#171b26] border border-[#2a3044] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{h.docName}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            Host: {h.hostName} ({h.ip})
                          </p>
                        </div>
                        <button
                          onClick={() => handleJoin(h.pairId)}
                          disabled={isJoining}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 flex items-center gap-1"
                        >
                          Gabung <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Pair ID input */}
              <div className="space-y-2 pt-1 border-t border-[#222636]">
                <label className="text-xs font-medium text-slate-300 block">
                  Atau Masukkan Pair ID dari Host
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pairIdInput}
                    onChange={(e) => setPairIdInput(e.target.value.toUpperCase())}
                    placeholder="Contoh: VLD-C0A80119-B3A2-4821"
                    className="flex-1 bg-[#0b0d13] border border-[#2a3044] focus:border-brand-violet rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                  <button
                    onClick={() => handleJoin()}
                    disabled={isJoining}
                    className="px-4 py-2 rounded-xl bg-brand-violet hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    {isJoining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Gabung'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
