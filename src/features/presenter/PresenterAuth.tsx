import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Mail, Lock, User as UserIcon, AlertCircle, Loader2, Eye, EyeOff, Wand2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { ThemeToggle } from '../../components/ThemeToggle'

export const PresenterAuth: React.FC = () => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'magic'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { user, profile, signInPresenter, signUpPresenter } = useAuth()
  const navigate = useNavigate()

  // Handle QR session transfer from another logged-in device (#transfer_access=...&transfer_refresh=...)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || !hash.includes('transfer_access=')) return

    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('transfer_access')
    const refreshToken = params.get('transfer_refresh')

    // Immediately strip tokens from URL bar / browser history
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    if (!accessToken || !refreshToken) return

    let active = true
    setLoading(true)
    setError(null)

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionErr }) => {
        if (!active) return
        if (sessionErr) {
          setError('QR login link expired or already used. Please generate a fresh QR code or sign in below.')
          setLoading(false)
        } else {
          navigate('/presenter/dashboard', { replace: true })
        }
      })
      .catch(() => {
        if (!active) return
        setError('Could not complete QR login. Please sign in with your email and password.')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [navigate])

  // Redirect automatically once authenticated as a presenter (e.g., via Magic Link)
  useEffect(() => {
    if (user && profile?.role === 'presenter') {
      navigate('/presenter/dashboard', { replace: true })
    }
  }, [user, profile, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanedEmail = email.trim()
    const cleanedPassword = password.trim()
    const cleanedName = name.trim()

    if (authMode === 'magic') {
      if (!cleanedEmail) {
        setError('Please enter your email address.')
        return
      }
      setLoading(true)
      try {
        const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}presenter/auth`
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email: cleanedEmail,
          options: { emailRedirectTo: redirectTo }
        })
        if (otpErr) throw otpErr
        setError('Magic login link sent! Check your email inbox on this device to sign in.')
      } catch (err: any) {
        console.error('Magic link failed:', err)
        setError(err.message || 'Could not send magic login link.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!cleanedEmail || !cleanedPassword || (authMode === 'signup' && !cleanedName)) {
      setError('Please fill in all fields.')
      return
    }

    if (cleanedPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)

    try {
      if (authMode === 'signup') {
        await signUpPresenter(cleanedEmail, cleanedPassword, cleanedName)
        setError('Verification link sent! Please check your email inbox to activate your account.')
      } else {
        await signInPresenter(cleanedEmail, cleanedPassword)
        navigate('/presenter/dashboard')
      }
    } catch (err: any) {
      console.error('Presenter auth failed:', err)
      setError(err.message || 'Authentication error. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 bg-bg text-text-primary selection:bg-brand-primary selection:text-white transition-colors duration-300">
      {/* Floating Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl glass-panel animate-glow">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-8 h-8 text-brand-accent animate-pulse-slow" />
            <span className="text-3xl font-extrabold tracking-wider text-gradient">YALCIT</span>
          </div>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-primary-light">
            Presenter Dashboard
          </span>
        </div>

        {error && (
          <div className={`flex items-start gap-3 p-4 mb-6 rounded-2xl text-sm ${
            error.includes('sent') 
              ? 'bg-brand-success/10 border border-brand-success/20 text-brand-success' 
              : 'bg-brand-error/10 border border-brand-error/20 text-brand-error'
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-secondary/50">
                  <UserIcon className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Professor Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-secondary/50">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                placeholder="e.g. prof@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300"
                disabled={loading}
              />
            </div>
          </div>

          {authMode !== 'magic' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-secondary/50">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full pl-12 pr-12 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-text-secondary/60 hover:text-text-primary transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 font-bold rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-light hover:to-brand-secondary transition-all duration-300 shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 cursor-pointer text-white"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : authMode === 'signup' ? (
              'Create Presenter Account'
            ) : authMode === 'magic' ? (
              <>
                <Wand2 className="w-5 h-5" />
                Send Magic Login Link
              </>
            ) : (
              'Sign In as Presenter'
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6 text-sm text-text-secondary">
          {authMode === 'signin' && (
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic')
                setError(null)
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-brand-primary-light transition-colors cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Sign in with Email Link (no password)
            </button>
          )}

          {authMode !== 'signin' ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin')
                  setError(null)
                }}
                className="font-bold text-brand-primary-light hover:text-brand-primary transition-colors cursor-pointer"
              >
                Sign In with Password
              </button>
            </p>
          ) : (
            <p>
              New to YALCIT?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup')
                  setError(null)
                }}
                className="font-bold text-brand-primary-light hover:text-brand-primary transition-colors cursor-pointer"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
