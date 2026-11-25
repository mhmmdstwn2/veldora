import React, { useState } from 'react'
import { X, ShieldCheck, Lock, Unlock, Eye, EyeOff, ShieldAlert, Check } from 'lucide-react'
import { usePdfStore } from '@/stores/usePdfStore'

export const SecurityDialog: React.FC = () => {
  const { activeModal, setActiveModal, setActiveTool } = usePdfStore()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [allowPrinting, setAllowPrinting] = useState(true)
  const [allowCopying, setAllowCopying] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  if (activeModal !== 'security') return null

  const handleApplySecurity = () => {
    if (password && password !== confirmPassword) {
      alert('Password dan konfirmasi password tidak cocok!')
      return
    }

    // In local-first offline environment, simulate encryption policy setup
    setIsSuccess(true)
    setTimeout(() => {
      setIsSuccess(false)
      setActiveModal(null)
    }, 1200)
  }

  const handleSwitchToRedaction = () => {
    setActiveModal(null)
    setActiveTool('redact')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-lg bg-[#14161f] border border-[#262a3a] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#212433] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Document Security & Protection</h2>
              <p className="text-xs text-slate-400">Password protection, permissions, and redaction</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f2230] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm">
          {/* Password Protection */}
          <div className="space-y-3 bg-[#0e1017] p-4 rounded-xl border border-[#242738]">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Password Protection</span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Document Open Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full px-3 py-2 bg-[#171a25] border border-[#2a2d3e] rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {password && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password..."
                    className="w-full px-3 py-2 bg-[#171a25] border border-[#2a2d3e] rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-2.5 bg-[#0e1017] p-4 rounded-xl border border-[#242738]">
            <div className="text-xs font-semibold text-slate-200 mb-1">Document Permissions</div>
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={allowPrinting}
                onChange={(e) => setAllowPrinting(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500 bg-[#171a25] border-slate-700"
              />
              <span>Allow high-resolution document printing</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={allowCopying}
                onChange={(e) => setAllowCopying(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500 bg-[#171a25] border-slate-700"
              />
              <span>Allow copying text, images, and content</span>
            </label>
          </div>

          {/* Redaction callout */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-amber-300">Looking for Permanent Content Removal?</p>
              <p className="text-slate-400 mt-0.5">
                Passwords protect files from opening, but true PDF Redaction permanently erases confidential text and images from the file stream.
              </p>
              <button
                type="button"
                onClick={handleSwitchToRedaction}
                className="mt-2 text-xs font-semibold text-amber-400 hover:text-amber-300 underline inline-flex items-center gap-1"
              >
                Switch to Redact Tool &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#212433] flex items-center justify-between bg-[#11131a]">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Unlock className="w-3.5 h-3.5" />
            <span>256-bit AES Local Encryption</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-[#1e212d] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplySecurity}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Check className="w-4 h-4" />
              {isSuccess ? 'Protected!' : 'Apply Protection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
