import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users, Play, Sparkles, Loader2, ArrowLeft, Copy, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { ThemeToggle } from '../../components/ThemeToggle'
import { SoundToggle } from '../../components/SoundToggle'
import { HelpGuideModal } from '../../components/HelpGuideModal'
import { useAuth } from '../../contexts/AuthContext'
import { playJoinPop } from '../../lib/soundEffects'

interface RosterUser {
  user_id: string
  display_name: string
  joined_at: string
}

export const PresenterLobby: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()

  // Redirect if not authenticated as a presenter
  useEffect(() => {
    if (!authLoading) {
      if (!user || profile?.role !== 'presenter') {
        navigate('/presenter/auth')
      }
    }
  }, [user, profile, authLoading, navigate])

  const [session, setSession] = useState<any>(null)
  const [participants, setParticipants] = useState<RosterUser[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  const prevParticipantCountRef = useRef(0)

  const baseUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
  const joinUrl = `${baseUrl}/session/${code?.toUpperCase()}`

  const handleCopyJoinLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // Fallback
    }
  }

  useEffect(() => {
    if (!code) return

    let presenceChannel: any = null

    const fetchSession = async () => {
      try {
        setLoading(true)
        // 1. Fetch Session row with quiz title
        const { data: sessionData, error: sessionErr } = await supabase
          .from('sessions')
          .select('*, quizzes(title)')
          .eq('code', code.toUpperCase())
          .single()

        if (sessionErr || !sessionData) {
          console.error('Session fetch error:', sessionErr)
          setError(sessionErr?.message || 'Session not found.')
          setLoading(false)
          return
        }

        setSession(sessionData)
        setLoading(false)

        // 2. Listen to student presence roster
        const channelName = `session_lobby:${code.toUpperCase()}`
        supabase.removeChannel(supabase.channel(channelName))
        presenceChannel = supabase.channel(channelName)

        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState()
            const uniqueUsers: Record<string, RosterUser> = {}

            // Map presence state to a list of users, keeping only the most recent session per user_id
            Object.keys(state).forEach((key) => {
              const presences = state[key] as any[]
              presences.forEach((presence) => {
                const existing = uniqueUsers[presence.user_id]
                if (!existing || new Date(presence.joined_at).getTime() > new Date(existing.joined_at).getTime()) {
                  uniqueUsers[presence.user_id] = {
                    user_id: presence.user_id,
                    display_name: presence.display_name,
                    joined_at: presence.joined_at,
                  }
                }
              })
            })

            const list = Object.values(uniqueUsers)
            // Sort by join timestamp
            list.sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())

            if (list.length > prevParticipantCountRef.current) {
              playJoinPop()
            }
            prevParticipantCountRef.current = list.length

            setParticipants(list)
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              setRealtimeStatus('connected')
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setRealtimeStatus('error')
            }
          })

      } catch (err: any) {
        console.error('Lobby initialization failed:', err)
        setError(err.message || 'Failed to setup lobby connections.')
        setLoading(false)
      }
    }

    fetchSession()

    return () => {
      if (presenceChannel) supabase.removeChannel(presenceChannel)
    }
  }, [code])

  // Move session to 'active' state and select the first question
  const handleStartQuiz = async () => {
    if (!session || starting) return
    setStarting(true)

    try {
      // Get the first question in the quiz template
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('id')
        .eq('quiz_id', session.quiz_id)
        .order('sort_order', { ascending: true })
        .limit(1)

      if (qErr || !questions || questions.length === 0) {
        throw new Error('This session has no questions to start.')
      }

      // Update session status to active and set first active question
      const { error: updateErr } = await supabase
        .from('sessions')
        .update({
          status: 'active',
          current_question_id: questions[0].id,
          current_question_revealed: false,
          current_question_started_at: new Date().toISOString()
        })
        .eq('id', session.id)

      if (updateErr) throw updateErr

      // Navigate to the presenter quiz manager
      navigate(`/presenter/session/${code?.toUpperCase()}/quiz`)
    } catch (err: any) {
      console.error('Start quiz error:', err)
      alert(err.message || 'Could not start quiz session.')
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-text-primary transition-colors duration-300">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mb-4" />
        <p className="text-text-secondary">Creating presenter lobby...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-bg text-text-primary text-center transition-colors duration-300">
        <h2 className="text-2xl font-bold mb-3">Lobby Failed</h2>
        <p className="text-text-secondary max-w-md mb-8">{error}</p>
        <button
          onClick={() => navigate('/presenter/dashboard')}
          className="px-6 py-3 font-semibold rounded-xl bg-white/10 dark:bg-white/5 border border-border hover:bg-white/15 dark:hover:bg-white/10 transition-all cursor-pointer text-text-primary"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  const quizTitle = session?.quizzes?.title || session?.settings?.title || 'Live Quiz Session'

  return (
    <div className="relative flex flex-col min-h-screen p-6 bg-bg text-text-primary transition-colors duration-300">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-border">
        <button
          onClick={() => navigate('/presenter/dashboard')}
          className="flex items-center gap-2 text-xs font-semibold hover:text-brand-primary-light transition-all cursor-pointer text-text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>
        <div className="flex items-center gap-3">
          <HelpGuideModal initialTab="live" />
          <SoundToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Board projection */}
      <main className="relative z-10 w-full max-w-5xl mx-auto flex-grow flex flex-col items-center justify-center text-center space-y-10">
        
        {/* Title & Join Info Card */}
        <div className="space-y-4 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-primary-light bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 rounded-full">
            Join the Live Interaction
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-text-primary leading-tight select-all">
            {quizTitle}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-sm text-text-secondary">
            <span>Go to</span>
            <span className="font-bold text-text-primary">{baseUrl}</span>
            <span>and enter the Room Code below:</span>
          </div>
        </div>

        {/* Giant Code & QR Projection Card */}
        <div className="p-8 px-10 rounded-3xl glass-panel animate-glow flex flex-col md:flex-row items-center justify-between gap-8 select-none max-w-2xl w-full">
          <div className="flex flex-col items-center md:items-start space-y-3">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest select-none">
              Room Code
            </span>
            <span className="text-6xl sm:text-7xl font-black tracking-widest text-text-primary select-all cursor-pointer">
              {code?.toUpperCase()}
            </span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyJoinLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/15 hover:bg-brand-primary/25 border border-brand-primary/30 text-xs font-bold text-brand-primary-light transition-all cursor-pointer active:scale-95"
                title="Copy direct join link for students"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-brand-success" />
                    <span className="text-brand-success">Join Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Direct Join Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center space-y-1.5 p-3 rounded-2xl bg-white shadow-lg border border-border/80 text-center">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=4f46e5&bgcolor=ffffff&data=${encodeURIComponent(joinUrl)}`}
              alt="Scan to Join"
              className="w-32 h-32 rounded-lg"
            />
            <span className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider">
              📷 Scan Camera to Join
            </span>
          </div>
        </div>

        {/* Connected Students Roster */}
        <div className="w-full max-w-3xl space-y-6">
          <div className="flex items-center justify-center gap-3">
            <Users className="w-5 h-5 text-brand-accent animate-pulse" />
            <h2 className="text-md font-bold text-text-primary">
              {participants.length} Student{participants.length !== 1 ? 's' : ''} Connected
            </h2>
          </div>

          <div className="flex flex-wrap justify-center gap-3 max-h-[220px] overflow-y-auto p-4 border border-dashed border-border rounded-2xl bg-white/5 dark:bg-white/5">
            {participants.map((p) => (
              <div
                key={p.user_id}
                className="px-4 py-2 rounded-xl bg-white/5 dark:bg-white/5 border border-border text-xs font-semibold text-text-primary hover:border-brand-primary/30 transition-all duration-200"
              >
                {p.display_name}
              </div>
            ))}

            {participants.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 text-text-secondary text-xs">
                <Sparkles className="w-6 h-6 text-border animate-spin mb-2" />
                <span>Waiting for the first student to connect...</span>
              </div>
            )}
          </div>
        </div>

        {/* Start Game controls */}
        <div className="pt-4">
          <button
            onClick={handleStartQuiz}
            disabled={starting || participants.length === 0}
            className="flex items-center gap-2.5 px-8 py-4 font-bold rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-light hover:to-brand-secondary hover:scale-[1.03] active:scale-[0.98] transition-all shadow-lg shadow-brand-primary/25 disabled:opacity-40 disabled:scale-100 disabled:pointer-events-none cursor-pointer text-white text-sm"
          >
            {starting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Quiz Session
                <Play className="w-5 h-5 fill-white" />
              </>
            )}
          </button>
          {participants.length === 0 && (
            <p className="text-[10px] text-brand-warning/80 mt-2.5 font-semibold">
              * Connect at least one student to unlock the quiz start button.
            </p>
          )}
        </div>
        {/* Realtime Connection Status Toast */}
        {realtimeStatus !== 'connected' && (
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold shadow-lg bg-yellow-500/10 border-yellow-500/20 text-yellow-500">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-ping" />
            <span>{realtimeStatus === 'connecting' ? 'Connecting to real-time sync...' : 'Disconnected. Reconnecting...'}</span>
          </div>
        )}
      </main>
    </div>
  )
}
