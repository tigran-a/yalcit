import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode, X, RefreshCw, ShieldAlert, Loader2, Smartphone } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

interface QrLoginModalProps {
  onClose: () => void
}

export const QrLoginModal: React.FC<QrLoginModalProps> = ({ onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const generateQr = async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const result = forceRefresh
        ? await supabase.auth.refreshSession()
        : await supabase.auth.getSession()

      if (result.error) throw result.error
      const session = result.data.session
      if (!session?.access_token || !session?.refresh_token) {
        throw new Error('No active session found.')
      }

      const params = new URLSearchParams({
        transfer_access: session.access_token,
        transfer_refresh: session.refresh_token
      })
      const baseUrl = `${window.location.origin}${import.meta.env.BASE_URL}presenter/auth`
      const transferUrl = `${baseUrl}#${params.toString()}`

      const dataUrl = await QRCode.toDataURL(transferUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      setQrDataUrl(dataUrl)
    } catch (err: any) {
      console.error('QR generation failed:', err)
      setError(err.message || 'Could not generate QR code.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generateQr(false)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm p-6 rounded-3xl glass-panel border border-border shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-primary/15 text-brand-primary-light">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-text-primary">Sign In on Another Device</h3>
              <p className="text-[11px] text-text-secondary">Scan with your phone or tablet camera</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-border min-h-[260px]">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-600">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <span className="text-xs font-medium">Generating local QR code...</span>
            </div>
          ) : error ? (
            <div className="text-center text-xs text-red-600 px-4">{error}</div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Presenter QR Login Code"
              className="w-56 h-56 rounded-lg"
            />
          ) : null}
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Keep this QR code private. Anyone who scans it can sign in as you. If this computer signs out later after transferring, just log back in.
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => generateQr(true)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-xs font-bold text-text-primary transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh QR
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary text-xs font-bold text-white cursor-pointer hover:scale-[1.02] transition-all"
          >
            <span className="flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" />
              Done
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
