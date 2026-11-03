import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Sparkles, ArrowRight, AlertCircle, Loader2, Presentation } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { ThemeToggle } from '../../components/ThemeToggle'

export const JoinSession: React.FC = () => {
  const { code: urlCode } = useParams<{ code?: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const [code, setCode] = useState(urlCode || location.state?.code || '')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (urlCode) {
      setCode(urlCode.toUpperCase())
    } else if (location.state?.code) {
      setCode(location.state.code.toUpperCase())
    }
  }, [urlCode, location.state])

  const { user, profile, signInAnonymously } = useAuth()

  const handlePresenterPortal = () => {
    if (user && profile?.role === 'presenter') {
      navigate('/presenter/dashboard')
    } else {
      navigate('/presenter/auth')
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanedCode = code.trim().toUpperCase()
    const cleanedNickname = nickname.trim()

    if (!cleanedCode || !cleanedNickname) {
      setError('Please fill in both the session code and your nickname.')
      return
    }

    if (cleanedCode.length < 4) {
      setError('Session code must be at least 4 characters long.')
      return
    }

    setLoading(true)

    try {
      // 1. Verify session exists and is joinable (status: 'waiting' or 'active')
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, status')
        .eq('code', cleanedCode)
        .maybeSingle()

      if (sessionError) throw sessionError

      if (!session) {
        setError('No active session found with this code. Please double-check.')
        setLoading(false)
        return
      }

      if (session.status === 'ended') {
        setError('This session has already ended.')
        setLoading(false)
        return
      }

      // 2. Perform anonymous authentication
      await signInAnonymously(cleanedNickname)

      // 3. Navigate: If session is already active, jump directly to the live quiz!
      if (session.status === 'active') {
        navigate(`/session/${cleanedCode}/quiz`, { state: { sessionId: session.id } })
      } else {
        navigate(`/session/${cleanedCode}/lobby`, { state: { sessionId: session.id } })
      }
    } catch (err: any) {
      console.error('Error joining session:', err)
      setError(err.message || 'An unexpected error occurred while joining.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 bg-bg text-text-primary selection:bg-brand-primary selection:text-white transition-colors duration-300">
      {/* Top Navigation Controls */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
        <button
          onClick={handlePresenterPortal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-border hover:border-brand-primary/40 hover:bg-white/10 text-xs font-bold text-text-primary transition-all duration-300 shadow-md cursor-pointer active:scale-95"
        >
          <Presentation className="w-4 h-4 text-brand-primary-light" />
          <span>{user && profile?.role === 'presenter' ? 'Presenter Dashboard' : 'Host a Quiz'}</span>
        </button>
        <ThemeToggle />
      </div>

      {/* Background glow animations */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl glass-panel animate-glow">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-8 h-8 text-brand-accent animate-bounce" />
            <span className="text-3xl font-extrabold tracking-wider text-gradient">YALCIT</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary-light mb-3 text-center">
            Yet Another Live Classroom Interaction Tool
          </span>
          <p className="text-sm text-text-secondary text-center">
            Enter a session code and choose a nickname to join the live interaction!
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm animate-pulse-slow">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label htmlFor="session-code" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
              Session Code
            </label>
            <input
              id="session-code"
              type="text"
              placeholder="e.g. ROOM42"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              className="w-full px-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-center text-xl font-bold tracking-widest text-text-primary placeholder:text-text-secondary/40 placeholder:tracking-normal focus:outline-none transition-all duration-300 uppercase"
              disabled={loading}
              maxLength={12}
            />
          </div>

          <div>
            <label htmlFor="nickname" className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
              Your Nickname
            </label>
            <input
              id="nickname"
              type="text"
              placeholder="e.g. CaptainAwesome"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="nickname"
              className="w-full px-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-center text-lg font-medium text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300"
              disabled={loading}
              maxLength={20}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2.5 px-6 py-4 font-bold rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-light hover:to-brand-secondary transition-all duration-300 shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none cursor-pointer text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                Enter Lobby
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border/60 text-center">
          <button
            type="button"
            onClick={handlePresenterPortal}
            className="text-xs font-semibold text-text-secondary hover:text-brand-primary-light transition-colors cursor-pointer"
          >
            Are you a teacher? <span className="font-bold text-brand-primary-light underline underline-offset-4">Open Presenter Portal →</span>
          </button>
        </div>
      </div>
    </div>
  )
}
