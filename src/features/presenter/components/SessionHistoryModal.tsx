import React, { useEffect, useState } from 'react'
import { BarChart3, Download, Loader2, Trophy, Users, Calendar, X, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

interface SessionHistoryModalProps {
  quizId: string
  quizTitle: string
  onClose: () => void
}

interface PastSession {
  id: string
  code: string
  status: string
  created_at: string
  speed_scoring: boolean
}

interface SessionParticipantSummary {
  nickname: string
  score: number
  correctCount: number
  totalAnswered: number
}

export const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  quizId,
  quizTitle,
  onClose,
}) => {
  const [sessions, setSessions] = useState<PastSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [standings, setStandings] = useState<SessionParticipantSummary[]>([])
  const [questionCount, setQuestionCount] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [loadingStandings, setLoadingStandings] = useState(false)

  useEffect(() => {
    const loadSessions = async () => {
      setLoading(true)
      try {
        const [{ data: sessData }, { count: qCount }] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, code, status, created_at, speed_scoring')
            .eq('quiz_id', quizId)
            .order('created_at', { ascending: false }),
          supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('quiz_id', quizId),
        ])

        setQuestionCount(qCount || 1)
        const list = (sessData || []) as PastSession[]
        setSessions(list)
        if (list.length > 0) {
          setSelectedSessionId(list[0].id)
        }
      } catch (err) {
        console.error('Failed to load session history:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSessions()
  }, [quizId])

  useEffect(() => {
    if (!selectedSessionId) {
      setStandings([])
      return
    }

    const loadStandings = async () => {
      setLoadingStandings(true)
      try {
        const { data } = await supabase
          .from('responses')
          .select('nickname, is_correct, points')
          .eq('session_id', selectedSessionId)

        const map: Record<string, SessionParticipantSummary> = {}
        ;(data || []).forEach((r: any) => {
          const name = r.nickname || 'Anonymous'
          if (!map[name]) {
            map[name] = { nickname: name, score: 0, correctCount: 0, totalAnswered: 0 }
          }
          const pts = r.points !== undefined && r.points !== null ? r.points : r.is_correct ? 100 : 0
          map[name].score += pts
          map[name].totalAnswered += 1
          if (r.is_correct) map[name].correctCount += 1
        })

        const sorted = Object.values(map).sort((a, b) => b.score - a.score)
        setStandings(sorted)
      } catch (err) {
        console.error('Error loading session standings:', err)
      } finally {
        setLoadingStandings(false)
      }
    }

    loadStandings()
  }, [selectedSessionId])

  const selectedSession = sessions.find((s) => s.id === selectedSessionId)

  const handleExportCSV = () => {
    if (!selectedSession || standings.length === 0) return

    const headers = ['Rank', 'Nickname', 'Total Score', 'Correct Answers', 'Total Questions', 'Accuracy (%)']
    const rows = standings.map((s, idx) => {
      const accuracy = Math.round((s.correctCount / questionCount) * 100)
      const safeName = `"${s.nickname.replace(/"/g, '""')}"`
      return [idx + 1, safeName, s.score, s.correctCount, questionCount, `${accuracy}%`].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `yalcit_${quizTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${selectedSession.code}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Delete this session history and its student responses?')) return
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
      if (error) throw error
      const remaining = sessions.filter((s) => s.id !== sessionId)
      setSessions(remaining)
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(remaining[0]?.id || null)
      }
    } catch (err) {
      console.error('Could not delete session:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl p-6 sm:p-8 rounded-3xl glass-panel border border-border shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-brand-primary/15 text-brand-primary-light">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary-light block">
                Session Analytics & Gradebook
              </span>
              <h3 className="text-lg font-black text-text-primary truncate">{quizTitle}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary-light" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 space-y-2 text-text-secondary">
            <Calendar className="w-10 h-10 mx-auto text-border" />
            <p className="text-sm font-bold text-text-primary">No Sessions Hosted Yet</p>
            <p className="text-xs">Host a live session for this quiz to view student rankings and export CSV results.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-hidden">
            {/* Left List of Sessions */}
            <div className="md:col-span-1 space-y-2 overflow-y-auto pr-1 max-h-[420px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-2">
                Sessions ({sessions.length})
              </span>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    s.id === selectedSessionId
                      ? 'bg-brand-primary/15 border-brand-primary/50 text-text-primary'
                      : 'bg-white/5 border-border hover:border-brand-primary/30 text-text-secondary'
                  }`}
                >
                  <div className="space-y-0.5 truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-brand-primary-light">
                        {s.code}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          s.status === 'ended'
                            ? 'bg-white/10 text-text-secondary'
                            : 'bg-brand-success/20 text-brand-success'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-secondary">
                      {new Date(s.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSession(s.id)
                    }}
                    className="p-1.5 rounded-lg hover:bg-brand-error/15 text-text-secondary hover:text-brand-error transition-all cursor-pointer"
                    title="Delete session record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Right Standings Table */}
            <div className="md:col-span-2 flex flex-col justify-between bg-white/5 border border-border rounded-2xl p-4 overflow-hidden">
              <div className="space-y-4 flex-grow overflow-hidden flex flex-col">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
                    <Users className="w-4 h-4 text-brand-accent" />
                    <span>{standings.length} Participant{standings.length !== 1 ? 's' : ''}</span>
                  </div>
                  {standings.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/15 hover:bg-brand-primary/25 border border-brand-primary/30 text-brand-primary-light text-xs font-bold transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  )}
                </div>

                {loadingStandings ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary-light" />
                  </div>
                ) : standings.length === 0 ? (
                  <div className="text-center py-12 text-xs text-text-secondary">
                    No responses recorded in this session.
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto pr-1 max-h-[300px]">
                    {standings.map((st, idx) => {
                      const accuracy = Math.round((st.correctCount / questionCount) * 100)
                      return (
                        <div
                          key={st.nickname}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-black ${
                                idx === 0
                                  ? 'bg-amber-400/20 text-amber-400'
                                  : idx === 1
                                  ? 'bg-slate-300/20 text-slate-300'
                                  : idx === 2
                                  ? 'bg-amber-700/20 text-amber-600'
                                  : 'bg-white/5 text-text-secondary'
                              }`}
                            >
                              {idx === 0 ? <Trophy className="w-3.5 h-3.5" /> : idx + 1}
                            </span>
                            <div>
                              <span className="font-bold text-text-primary block">{st.nickname}</span>
                              <span className="text-[10px] text-text-secondary">
                                {st.correctCount}/{questionCount} correct ({accuracy}%)
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-black text-brand-primary-light">
                            {st.score} pts
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
