import React, { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { Users, Loader2, Smile } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { ThemeToggle } from '../../components/ThemeToggle'

interface RosterUser {
  user_id: string
  display_name: string
  joined_at: string
}

export const StudentLobby: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  
  const { user, profile } = useAuth()
  
  const [participants, setParticipants] = useState<RosterUser[]>([])
  const [sessionId, setSessionId] = useState<string | null>(location.state?.sessionId || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code || !user || !profile) return

    let presenceChannel: any = null
    let dbChannel: any = null

    const setupRealtime = async () => {
      try {
        // 1. Fetch Session ID if not present in navigation state
        let currentSessionId = sessionId
        if (!currentSessionId) {
          const { data, error: fetchErr } = await supabase
            .from('sessions')
            .select('id, status')
            .eq('code', code.toUpperCase())
            .single()

          if (fetchErr || !data) {
            setError('Could not connect to the session. It may have ended.')
            setLoading(false)
            return
          }
          currentSessionId = data.id
          setSessionId(data.id)
        }

        setLoading(false)

        // 2. Setup Presence channel for student roster
        const lobbyChannelName = `session_lobby:${code.toUpperCase()}`
        supabase.removeChannel(supabase.channel(lobbyChannelName))
        presenceChannel = supabase.channel(lobbyChannelName)

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
            // Sort participants by join time
            list.sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
            setParticipants(list)
          })
          .subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({
                user_id: user.id,
                display_name: profile.display_name,
                joined_at: new Date().toISOString(),
              })
            }
          })

        // 3. Setup Postgres Changes to detect presenter starting the session
        const updatesChannelName = `session_updates:${currentSessionId}`
        supabase.removeChannel(supabase.channel(updatesChannelName))
        dbChannel = supabase.channel(updatesChannelName)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'sessions',
              filter: `id=eq.${currentSessionId}`,
            },
            (payload) => {
              const updatedSession = payload.new
              
              // If presenter starts the quiz (sets status to 'active' and provides current question)
              if (updatedSession.status === 'active' && updatedSession.current_question_id) {
                navigate(`/session/${code.toUpperCase()}/quiz`, {
                  state: { sessionId: currentSessionId },
                })
              }
              
              if (updatedSession.status === 'ended') {
                setError('This session has been ended by the presenter.')
              }
            }
          )
          .subscribe()

      } catch (err: any) {
        console.error('Lobby realtime setup failed:', err)
        setError('Real-time connection error. Please refresh.')
        setLoading(false)
      }
    }

    setupRealtime()

    return () => {
      if (presenceChannel) supabase.removeChannel(presenceChannel)
      if (dbChannel) supabase.removeChannel(dbChannel)
    }
  }, [code, user, profile, sessionId, navigate])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-text-primary transition-colors duration-300">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mb-4" />
        <p className="text-text-secondary">Loading lobby session...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-bg text-text-primary text-center transition-colors duration-300">
        <div className="w-16 h-16 bg-brand-error/15 text-brand-error rounded-full flex items-center justify-center mb-6">
          <Smile className="w-8 h-8 rotate-180" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Unable to Join Lobby</h2>
        <p className="text-text-secondary max-w-md mb-8">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 font-semibold rounded-xl bg-white/10 dark:bg-white/5 border border-border hover:bg-white/15 dark:hover:bg-white/10 transition-all cursor-pointer"
        >
          Return Home
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col min-h-screen p-6 bg-bg text-text-primary transition-colors duration-300">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-wider text-gradient">YALCIT</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 dark:bg-white/5 border border-border px-4 py-2 rounded-full">
            <Users className="w-4 h-4 text-brand-accent" />
            <span className="text-xs font-semibold text-text-secondary">
              {participants.length} Participant{participants.length !== 1 ? 's' : ''} Online
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Roster & Waiting Details */}
      <main className="relative z-10 w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 flex-grow">
        {/* Left Side Info Panel */}
        <div className="md:col-span-1 p-6 rounded-3xl glass-panel self-start space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Joined Code</span>
            <div className="text-4xl font-black text-text-primary mt-1 select-all tracking-wider">{code?.toUpperCase()}</div>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Your Nickname</span>
            <div className="text-lg font-semibold text-brand-primary-light mt-1 flex items-center gap-2">
              <Smile className="w-5 h-5" />
              {profile?.display_name}
            </div>
          </div>
          <div className="pt-4 border-t border-border flex items-center gap-3 text-text-secondary text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-brand-primary-light flex-shrink-0" />
            <span>Waiting for the presenter to start the quiz...</span>
          </div>
        </div>

        {/* Right Side Roster Grid */}
        <div className="md:col-span-2 p-8 rounded-3xl glass-panel flex flex-col h-[500px]">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-3">
            <Users className="w-5 h-5 text-brand-primary-light" />
            Joined Classmates
          </h2>

          <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 gap-3 self-stretch align-content-start">
            {participants.map((participant) => (
              <div
                key={participant.user_id}
                className={`p-3 rounded-xl border text-center transition-all duration-300 font-semibold truncate ${
                  participant.user_id === user?.id
                    ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary-light animate-glow'
                    : 'bg-white/5 dark:bg-white/5 border-border hover:border-brand-primary/30 text-text-secondary'
                }`}
              >
                {participant.display_name}
              </div>
            ))}
            
            {participants.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center h-full text-text-secondary">
                <Smile className="w-12 h-12 text-border mb-3" />
                <p>No classmates joined yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
