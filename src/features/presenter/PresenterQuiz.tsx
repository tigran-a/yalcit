import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Loader2, Award, Clock, ArrowRight, Check, Users, Square, Zap,
  Download, Maximize2, Minimize2, ArrowLeft, Eye, EyeOff, Cloud, List
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from 'recharts'
import confetti from 'canvas-confetti'
import { supabase } from '../../lib/supabaseClient'
import { ThemeToggle } from '../../components/ThemeToggle'
import { SoundToggle } from '../../components/SoundToggle'
import { useAuth } from '../../contexts/AuthContext'
import { playTick, playRevealChime, playVictoryFanfare } from '../../lib/soundEffects'

interface StudentResponse {
  id: string
  answer: { option_id?: string; text?: string }
  is_correct: boolean
  points?: number
  nickname: string
  user_id: string
}

interface ScoreboardEntry {
  nickname: string
  score: number
  correctCount: number
  totalAnswered: number
}

export const PresenterQuiz: React.FC = () => {
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

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  const [responses, setResponses] = useState<StudentResponse[]>([])
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([])
  const [onlineParticipantCount, setOnlineParticipantCount] = useState<number>(0)
  const [knownParticipantIds, setKnownParticipantIds] = useState<Set<string>>(new Set())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Question Controller States
  const [timeLeft, setTimeLeft] = useState(30)
  const [timerActive, setTimerActive] = useState(false)
  const [questionRevealed, setQuestionRevealed] = useState(false)
  const [showScoreboard, setShowScoreboard] = useState(false)
  const [hideLiveBreakdown, setHideLiveBreakdown] = useState(true)
  const [openEndedViewMode, setOpenEndedViewMode] = useState<'cloud' | 'list'>('cloud')
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  const timerRef = useRef<any>(null)

  const activeQuestion = questions[currentQuestionIndex]

  // Toggle browser fullscreen for classroom projection
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // 1. Initial Load of session, questions (including correct_option_id), and scoreboard state
  useEffect(() => {
    if (!code) return

    const init = async () => {
      try {
        setLoading(true)

        // Fetch session row
        const { data: session, error: sessionErr } = await supabase
          .from('sessions')
          .select('id, quiz_id, status, current_question_id, current_question_revealed')
          .eq('code', code.toUpperCase())
          .single()

        if (sessionErr || !session) {
          setError('Session not found.')
          setLoading(false)
          return
        }

        setSessionId(session.id)
        setQuestionRevealed(session.current_question_revealed)

        // Fetch questions order with correct answers joined
        const { data: questionsData, error: qErr } = await supabase
          .from('questions')
          .select('*, question_answers(correct_option_id)')
          .eq('quiz_id', session.quiz_id)
          .order('sort_order', { ascending: true })

        if (qErr || !questionsData || questionsData.length === 0) {
          throw new Error('No questions found in this session.')
        }

        const mappedQuestions = questionsData.map((q: any) => {
          const correctAns =
            q.question_answers?.correct_option_id ||
            (Array.isArray(q.question_answers) ? q.question_answers[0]?.correct_option_id : '') ||
            q.correct_option_id ||
            ''
          return {
            ...q,
            correct_option_id: correctAns
          }
        })

        setQuestions(mappedQuestions)

        // Find currently active index in database
        const dbActiveIdx = mappedQuestions.findIndex(q => q.id === session.current_question_id)
        const activeIdx = dbActiveIdx !== -1 ? dbActiveIdx : 0
        setCurrentQuestionIndex(activeIdx)

        // Start countdown timer
        const currentQ = mappedQuestions[activeIdx]
        setTimeLeft(currentQ.time_limit)
        setTimerActive(!session.current_question_revealed && session.status !== 'ended')

        // Fetch current responses for this active question in THIS session
        const { data: currentResponses } = await supabase
          .from('responses')
          .select('id, answer, is_correct, points, nickname, user_id')
          .eq('session_id', session.id)
          .eq('question_id', currentQ.id)

        setResponses(currentResponses || [])

        // Fetch all distinct participants who have answered so far in this session
        const { data: allSessionResponses } = await supabase
          .from('responses')
          .select('user_id')
          .eq('session_id', session.id)

        if (allSessionResponses) {
          const ids = new Set<string>()
          allSessionResponses.forEach((r: any) => {
            if (r.user_id) ids.add(r.user_id)
          })
          setKnownParticipantIds(ids)
        }

      } catch (err: any) {
        console.error('Quiz init failed:', err)
        let displayError = err.message || 'Initialization failed.'
        if (displayError.includes('row-level security policy') || displayError.includes('JWT')) {
          displayError = 'Authorization Error: Your presenter session is invalid or has expired. If you were testing in another tab as a student, your login token was overwritten. Please return to the dashboard and log in as a presenter again.'
        }
        setError(displayError)
      } finally {
        setLoading(false)
      }
    }

    init()

    // Subscribe to student presence channel so presenter knows live connected student count
    const presenceChannelName = `session_lobby:${code.toUpperCase()}`
    supabase.removeChannel(supabase.channel(presenceChannelName))
    const presenceChannel = supabase.channel(presenceChannelName)
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        const uniqueIds = new Set<string>()
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[]
          presences.forEach((p) => {
            if (p.user_id) uniqueIds.add(p.user_id)
          })
        })
        setOnlineParticipantCount(uniqueIds.size)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [code])

  // 2. Real-time changes subscription for incoming student responses
  useEffect(() => {
    if (!activeQuestion || !sessionId) return

    const fetchQuestionResponses = async () => {
      const { data } = await supabase
        .from('responses')
        .select('id, answer, is_correct, points, nickname, user_id')
        .eq('session_id', sessionId)
        .eq('question_id', activeQuestion.id)

      if (data) setResponses(data)
    }

    fetchQuestionResponses()

    const responseChannelName = `live_responses:${sessionId}:${activeQuestion.id}`
    supabase.removeChannel(supabase.channel(responseChannelName))
    const responseChannel = supabase.channel(responseChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses',
          filter: `question_id=eq.${activeQuestion.id}`
        },
        (payload) => {
          const newResponse = payload.new as any
          if (newResponse.session_id && newResponse.session_id !== sessionId) return
          if (newResponse.user_id) {
            setKnownParticipantIds(prev => {
              const next = new Set(prev)
              next.add(newResponse.user_id)
              return next
            })
          }
          setResponses(prev => {
            if (prev.some(r => r.id === newResponse.id)) return prev
            return [...prev, newResponse]
          })
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error')
        }
      })

    return () => {
      supabase.removeChannel(responseChannel)
    }
  }, [activeQuestion, sessionId])

  // 3. Countdown timer logic with sound effects in last 5 seconds
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      if (timeLeft <= 5) {
        playTick(timeLeft <= 2)
      }
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false)
      handleCloseQuestionAndReveal()
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [timeLeft, timerActive])

  // 4. Reveal correct answer to students & close submissions
  const handleCloseQuestionAndReveal = async () => {
    if (!sessionId || !activeQuestion) return
    setTimerActive(false)

    try {
      const { error: revealErr } = await supabase
        .from('sessions')
        .update({ current_question_revealed: true })
        .eq('id', sessionId)

      if (revealErr) throw revealErr
      setQuestionRevealed(true)
      playRevealChime()

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 }
      })

      const { data: gradedResponses, error: reloadErr } = await supabase
        .from('responses')
        .select('id, answer, is_correct, points, nickname, user_id')
        .eq('session_id', sessionId)
        .eq('question_id', activeQuestion.id)

      if (!reloadErr && gradedResponses) {
        setResponses(gradedResponses)
      }

    } catch (err: any) {
      console.error('Error revealing answer:', err)
      let displayError = err.message || 'Could not close the question. Please try again.'
      if (displayError.includes('row-level security policy')) {
        displayError = 'Security Violation: Cannot close question. Your presenter session has expired or was overwritten by a student session in another tab. Please sign out and sign back in.'
      }
      setError(displayError)
    }
  }

  // Calculate live MCQ chart data
  const getChartData = () => {
    if (!activeQuestion || activeQuestion.type !== 'multiple_choice') return []

    return activeQuestion.options.map((opt: any) => {
      const voteCount = responses.filter(r => r.answer?.option_id === opt.id).length
      return {
        name: `Option ${opt.id}`,
        votes: (!questionRevealed && hideLiveBreakdown) ? 0 : voteCount,
        rawVotes: voteCount,
        optionText: opt.text
      }
    })
  }

  // Group Open-Ended answers by normalized text for Word Cloud visualization
  const getWordCloudData = () => {
    if (!activeQuestion || activeQuestion.type !== 'open_ended') return []

    const groups: Record<string, { displayText: string; count: number; isCorrect: boolean; nicknames: string[] }> = {}

    responses.forEach((r) => {
      const rawText = (r.answer?.text || '').trim()
      if (!rawText) return
      const key = rawText.toLowerCase()
      if (!groups[key]) {
        groups[key] = {
          displayText: rawText,
          count: 0,
          isCorrect: !!r.is_correct,
          nicknames: []
        }
      }
      groups[key].count += 1
      if (r.is_correct) groups[key].isCorrect = true
      if (r.nickname) groups[key].nicknames.push(r.nickname)
    })

    const list = Object.values(groups)
    // Sort by count descending, then alphabetically for stable layout
    list.sort((a, b) => b.count - a.count || a.displayText.localeCompare(b.displayText))
    return list
  }

  // Aggregate global scoreboard scores across all questions in the session
  const fetchScoreboard = async () => {
    if (!sessionId) return
    try {
      const { data, error: scoreErr } = await supabase
        .from('responses')
        .select('nickname, is_correct, points')
        .eq('session_id', sessionId)

      if (scoreErr) throw scoreErr

      const stats: Record<string, { score: number; correctCount: number; totalAnswered: number }> = {}
      data.forEach((r: any) => {
        if (!stats[r.nickname]) {
          stats[r.nickname] = { score: 0, correctCount: 0, totalAnswered: 0 }
        }
        const earned = r.points !== undefined && r.points !== null ? r.points : (r.is_correct ? 100 : 0)
        stats[r.nickname].score += earned
        stats[r.nickname].totalAnswered += 1
        if (r.is_correct) stats[r.nickname].correctCount += 1
      })

      const board: ScoreboardEntry[] = Object.keys(stats).map(key => ({
        nickname: key,
        score: stats[key].score,
        correctCount: stats[key].correctCount,
        totalAnswered: stats[key].totalAnswered
      }))

      board.sort((a, b) => b.score - a.score)
      setScoreboard(board)
      setShowScoreboard(true)

    } catch (err) {
      console.error('Error fetching scoreboard:', err)
    }
  }

  // Export CSV gradebook of session standings
  const handleExportCSV = () => {
    if (scoreboard.length === 0) return

    const headers = ['Rank', 'Nickname', 'Total Score', 'Correct Answers', 'Total Questions', 'Accuracy (%)']
    const totalQ = questions.length || 1
    const rows = scoreboard.map((entry, idx) => {
      const accuracy = Math.round((entry.correctCount / totalQ) * 100)
      const safeName = `"${(entry.nickname || '').replace(/"/g, '""')}"`
      return [idx + 1, safeName, entry.score, entry.correctCount, totalQ, `${accuracy}%`].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `yalcit_session_${code?.toUpperCase() || 'results'}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Navigate to next question or end the quiz session
  const handleNext = async () => {
    if (!sessionId) return

    const nextIndex = currentQuestionIndex + 1

    if (nextIndex < questions.length) {
      const nextQuestion = questions[nextIndex]
      setLoading(true)

      try {
        const { error: nextErr } = await supabase
          .from('sessions')
          .update({
            current_question_id: nextQuestion.id,
            current_question_revealed: false,
            current_question_started_at: new Date().toISOString()
          })
          .eq('id', sessionId)

        if (nextErr) throw nextErr

        setResponses([])
        setQuestionRevealed(false)
        setShowScoreboard(false)
        setCurrentQuestionIndex(nextIndex)
        setTimeLeft(nextQuestion.time_limit)
        setTimerActive(true)

      } catch (err) {
        console.error('Navigate next error:', err)
      } finally {
        setLoading(false)
      }
    } else {
      // End the quiz session
      setLoading(true)
      try {
        const { error: endErr } = await supabase
          .from('sessions')
          .update({ status: 'ended' })
          .eq('id', sessionId)

        if (endErr) throw endErr

        playVictoryFanfare()
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.5 }
        })

        await fetchScoreboard()
        setShowScoreboard(true)

      } catch (err: any) {
        console.error('End session error:', err)
        let displayError = err.message || 'Could not end the quiz session. Please try again.'
        if (displayError.includes('row-level security policy')) {
          displayError = 'Security Violation: Cannot end session. Your presenter session has expired. Please sign out and sign back in.'
        }
        setError(displayError)
      } finally {
        setLoading(false)
      }
    }
  }

  // Keyboard shortcuts for presenter convenience (Space / ArrowRight / F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (loading || error) return

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (showScoreboard) {
          if (currentQuestionIndex + 1 < questions.length) {
            handleNext()
          }
        } else if (!questionRevealed) {
          setTimeLeft(0)
          setTimerActive(false)
          handleCloseQuestionAndReveal()
        } else {
          handleNext()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, error, showScoreboard, questionRevealed, currentQuestionIndex, questions.length, sessionId, activeQuestion])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-text-primary transition-colors duration-300">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mb-4" />
        <p className="text-text-secondary">Updating quiz stream...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-bg text-text-primary text-center transition-colors duration-300">
        <h2 className="text-2xl font-bold mb-3">Quiz Manager Error</h2>
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

  const matchedCorrectOption =
    activeQuestion?.type === 'multiple_choice'
      ? activeQuestion.options?.find((opt: any) => opt.id === activeQuestion.correct_option_id)
      : null

  const totalParticipants = Math.max(onlineParticipantCount, knownParticipantIds.size, responses.length)
  const allParticipantsAnswered = totalParticipants > 0 && responses.length >= totalParticipants

  return (
    <div className="relative flex flex-col min-h-screen p-6 bg-bg text-text-primary transition-colors duration-300">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 mb-8 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/presenter/dashboard')}
            className="p-2 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold bg-white/5 dark:bg-white/5 border border-border px-3 py-1.5 rounded-full text-text-secondary select-none">
            Room Code: <span className="text-brand-accent font-mono font-bold select-all cursor-pointer">{code?.toUpperCase()}</span>
          </span>
          <span className="text-xs font-bold text-text-secondary">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            allParticipantsAnswered
              ? 'bg-brand-success/15 border-brand-success/40 text-brand-success'
              : 'bg-white/5 dark:bg-white/5 border-border text-text-secondary'
          }`}>
            {allParticipantsAnswered ? (
              <Check className="w-4 h-4 text-brand-success" />
            ) : (
              <Users className="w-4 h-4 text-brand-primary-light" />
            )}
            <span>
              {responses.length}{totalParticipants > 0 ? ` / ${totalParticipants}` : ''} Answered
            </span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/5 border border-border hover:border-brand-primary/30 text-text-secondary hover:text-text-primary transition-all duration-300 shadow-md flex items-center justify-center cursor-pointer active:scale-95"
            title="Toggle Fullscreen (Shortcut: F)"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <SoundToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Board projections */}
      <main className="relative z-10 w-full max-w-5xl mx-auto flex-grow flex flex-col justify-center">
        
        {showScoreboard ? (
          /* SCOREBOARD & WINNER PODIUM OVERLAY SCREEN */
          <div className="p-8 rounded-3xl glass-panel animate-glow space-y-8 max-w-2xl mx-auto w-full">
            <div className="text-center space-y-2">
              <Award className="w-12 h-12 text-brand-accent mx-auto animate-bounce" />
              <h2 className="text-3xl font-black text-gradient">
                {currentQuestionIndex + 1 >= questions.length ? 'Final Winner Podium' : 'Leaderboard Standings'}
              </h2>
              <p className="text-xs text-text-secondary">
                {currentQuestionIndex + 1 >= questions.length 
                  ? 'Congratulations to the champions!' 
                  : 'Current scores across all rounds'}
              </p>
            </div>

            {/* TOP 3 WINNER PODIUM */}
            {scoreboard.length > 0 && (
              <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4 pb-2">
                {/* 2nd Place (Left) */}
                <div className="flex flex-col items-center space-y-2 w-24 sm:w-32">
                  {scoreboard[1] ? (
                    <>
                      <div className="text-center truncate w-full">
                        <span className="text-xs font-bold text-slate-300 block truncate">{scoreboard[1].nickname}</span>
                        <span className="text-[10px] font-mono text-slate-400 block">{scoreboard[1].score} pts</span>
                      </div>
                      <div className="w-full h-28 rounded-t-2xl bg-gradient-to-t from-slate-500/20 to-slate-400/30 border-t-4 border-slate-300 flex flex-col items-center justify-start pt-3 shadow-lg">
                        <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-900 font-black text-xs flex items-center justify-center shadow">
                          2nd
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-28 rounded-t-2xl bg-white/5 border-t-2 border-border/30" />
                  )}
                </div>

                {/* 1st Place (Center - Tallest) */}
                <div className="flex flex-col items-center space-y-2 w-28 sm:w-36">
                  {scoreboard[0] ? (
                    <>
                      <span className="text-2xl animate-bounce">👑</span>
                      <div className="text-center truncate w-full">
                        <span className="text-sm font-black text-amber-400 block truncate">{scoreboard[0].nickname}</span>
                        <span className="text-xs font-mono font-bold text-amber-300 block">{scoreboard[0].score} pts</span>
                      </div>
                      <div className="w-full h-36 rounded-t-2xl bg-gradient-to-t from-amber-500/30 to-amber-400/40 border-t-4 border-amber-400 flex flex-col items-center justify-start pt-3 shadow-xl shadow-amber-500/10">
                        <span className="w-9 h-9 rounded-full bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shadow-lg">
                          1st
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-36 rounded-t-2xl bg-white/5 border-t-2 border-border/30" />
                  )}
                </div>

                {/* 3rd Place (Right) */}
                <div className="flex flex-col items-center space-y-2 w-24 sm:w-32">
                  {scoreboard[2] ? (
                    <>
                      <div className="text-center truncate w-full">
                        <span className="text-xs font-bold text-amber-600 block truncate">{scoreboard[2].nickname}</span>
                        <span className="text-[10px] font-mono text-amber-700/80 block">{scoreboard[2].score} pts</span>
                      </div>
                      <div className="w-full h-20 rounded-t-2xl bg-gradient-to-t from-amber-800/20 to-amber-700/30 border-t-4 border-amber-600 flex flex-col items-center justify-start pt-2 shadow">
                        <span className="w-7 h-7 rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center shadow">
                          3rd
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-20 rounded-t-2xl bg-white/5 border-t-2 border-border/30" />
                  )}
                </div>
              </div>
            )}

            {/* FULL STANDINGS LIST */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {scoreboard.map((entry, idx) => (
                <div
                  key={entry.nickname}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold ${
                      idx === 0 
                        ? 'bg-amber-400/20 text-amber-400' 
                        : idx === 1
                        ? 'bg-slate-300/20 text-slate-300'
                        : idx === 2
                        ? 'bg-amber-700/20 text-amber-600'
                        : 'bg-white/5 text-text-secondary/50'
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-text-primary text-sm block">{entry.nickname}</span>
                      <span className="text-[10px] text-text-secondary">
                        {entry.correctCount} / {questions.length} correct
                      </span>
                    </div>
                  </div>
                  <span className="font-black text-brand-primary-light font-mono text-sm">{entry.score} pts</span>
                </div>
              ))}

              {scoreboard.length === 0 && (
                <div className="text-center p-6 text-text-secondary text-xs">
                  No scores recorded yet.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              {scoreboard.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-5 py-3 font-bold rounded-xl bg-white/5 border border-border hover:bg-white/10 transition-all text-xs text-text-primary cursor-pointer"
                  title="Download CSV Gradebook Report"
                >
                  <Download className="w-4 h-4 text-brand-accent" />
                  Export Results (CSV)
                </button>
              )}

              {currentQuestionIndex + 1 < questions.length ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 font-bold rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.03] transition-all text-sm text-white cursor-pointer"
                >
                  Next Question
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => navigate('/presenter/dashboard')}
                  className="flex items-center gap-2 px-6 py-3 font-bold rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.03] transition-all text-sm text-white cursor-pointer"
                >
                  Return to Dashboard
                </button>
              )}
            </div>
          </div>
        ) : (
          /* LIVE ACTIVE QUESTION CONTROL PANEL */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* Left Question Text Display (Col span 1) */}
            <div className="md:col-span-1 p-8 rounded-3xl glass-panel space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-brand-primary-light uppercase tracking-wider block">
                  Active Question #{currentQuestionIndex + 1}
                </span>
                <h2 className="text-2xl font-black text-text-primary leading-snug">
                  {activeQuestion.title}
                </h2>
                {activeQuestion.image_url && (
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-border bg-slate-100 dark:bg-white/5 shadow-md flex items-center justify-center">
                    <img 
                      src={activeQuestion.image_url} 
                      alt="Question context" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Timer Clock */}
                {timerActive ? (
                  <div className={`flex items-center gap-3 border p-4 rounded-2xl justify-center transition-colors ${
                    timeLeft <= 5
                      ? 'bg-brand-error/15 border-brand-error/40 text-brand-error animate-pulse'
                      : 'bg-white/5 dark:bg-white/5 border-border text-text-primary'
                  }`}>
                    <Clock className={`w-6 h-6 ${timeLeft <= 5 ? 'text-brand-error' : 'text-brand-accent'} animate-pulse`} />
                    <span className="text-3xl font-black font-mono">
                      {timeLeft}s
                    </span>
                  </div>
                ) : (
                  <div className="bg-brand-error/10 border border-brand-error/20 p-4 rounded-2xl text-center">
                    <span className="text-xs font-bold text-brand-error uppercase tracking-wider">
                      Submissions Closed
                    </span>
                  </div>
                )}

                {/* Controller Action buttons */}
                <div className="space-y-2.5">
                  {allParticipantsAnswered && !questionRevealed && (
                    <div className="p-2.5 rounded-xl bg-brand-success/15 border border-brand-success/30 text-brand-success text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-pulse">
                      <Check className="w-4 h-4" />
                      <span>All {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''} answered!</span>
                    </div>
                  )}

                  {!questionRevealed ? (
                    <div className="space-y-2">
                      {allParticipantsAnswered && (
                        <button
                          onClick={handleNext}
                          className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-brand-success/20 flex items-center justify-center gap-2"
                        >
                          <span>{currentQuestionIndex + 1 < questions.length ? 'Jump to Next Question' : 'Finish & Show Results'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setTimeLeft(0)
                          setTimerActive(false)
                          handleCloseQuestionAndReveal()
                        }}
                        className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                      >
                        {timerActive ? (
                          <>
                            <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-pulse" />
                            <span>{allParticipantsAnswered ? 'Reveal Correct Answer' : 'Interrupt & Finish Question Now'}</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-4 h-4 fill-current" />
                            <span>Close & Reveal Correct Answer</span>
                          </>
                        )}
                      </button>

                      {!allParticipantsAnswered && (
                        <button
                          onClick={handleNext}
                          className="w-full py-2.5 rounded-xl font-bold text-xs text-text-secondary hover:text-text-primary bg-white/5 border border-border hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>{currentQuestionIndex + 1 < questions.length ? 'Skip to Next Question' : 'Skip & End Quiz'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={fetchScoreboard}
                        className="py-3.5 rounded-xl font-bold text-xs text-text-primary bg-white/5 dark:bg-white/5 border border-border hover:bg-white/10 transition-all cursor-pointer"
                      >
                        Show Leaderboard
                      </button>
                      <button
                        onClick={handleNext}
                        className="py-3.5 rounded-xl font-bold text-xs text-white bg-brand-success hover:bg-brand-success/95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {currentQuestionIndex + 1 < questions.length ? 'Next Q' : 'End Quiz'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Interactive Chart & Projector Options Visualizer (Col span 2) */}
            <div className="md:col-span-2 p-6 sm:p-8 rounded-3xl glass-panel flex flex-col justify-between space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-text-primary">
                    {activeQuestion.type === 'multiple_choice' ? 'Classroom Projection & Live Responses' : 'Open-Ended Word Cloud & Responses'}
                  </h3>
                  {activeQuestion.type === 'open_ended' && (
                    <div className="inline-flex items-center rounded-xl bg-white/5 border border-border p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setOpenEndedViewMode('cloud')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          openEndedViewMode === 'cloud'
                            ? 'bg-brand-primary text-white shadow'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Cloud className="w-3 h-3" />
                        <span>Word Cloud</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenEndedViewMode('list')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                          openEndedViewMode === 'list'
                            ? 'bg-brand-primary text-white shadow'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <List className="w-3 h-3" />
                        <span>Cards</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!questionRevealed && (
                    <button
                      type="button"
                      onClick={() => setHideLiveBreakdown(!hideLiveBreakdown)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        hideLiveBreakdown
                          ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary-light'
                          : 'bg-white/5 border-border text-text-secondary hover:text-text-primary'
                      }`}
                      title="Hide or peek live vote breakdown while students are still answering"
                    >
                      {hideLiveBreakdown ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Votes Hidden Until Reveal</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Showing Live Votes</span>
                        </>
                      )}
                    </button>
                  )}
                  <span className="text-[10px] font-semibold text-text-secondary/60 hidden lg:inline">
                    Space / → to advance · F Fullscreen
                  </span>
                </div>
              </div>

              {activeQuestion.type === 'multiple_choice' ? (
                <div className="flex-grow flex flex-col justify-between space-y-5">
                  {/* Projector-Friendly Option Cards so students can read A, B, C, D on the big screen */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeQuestion.options.map((opt: any) => {
                      const isCorrectOpt = questionRevealed && opt.id === activeQuestion.correct_option_id
                      const voteCount = responses.filter(r => r.answer?.option_id === opt.id).length
                      const showCount = questionRevealed || !hideLiveBreakdown

                      return (
                        <div
                          key={opt.id}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all duration-300 ${
                            isCorrectOpt
                              ? 'bg-brand-success/20 border-brand-success text-brand-success shadow-lg shadow-brand-success/10 ring-2 ring-brand-success/40'
                              : questionRevealed
                              ? 'bg-white/5 border-border/50 opacity-65 text-text-secondary'
                              : 'bg-white/5 dark:bg-white/5 border-border text-text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center flex-shrink-0 ${
                              isCorrectOpt
                                ? 'bg-brand-success text-white'
                                : 'bg-brand-primary/20 text-brand-primary-light border border-brand-primary/30'
                            }`}>
                              {opt.id}
                            </span>
                            <div className="min-w-0">
                              <span className="font-extrabold text-sm sm:text-base block break-words leading-snug">
                                {opt.text}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {opt.image_url && (
                              <img
                                src={opt.image_url}
                                alt={`Option ${opt.id}`}
                                className="w-12 h-12 rounded-lg object-cover border border-border"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            {showCount && (
                              <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold font-mono ${
                                isCorrectOpt
                                  ? 'bg-brand-success text-white'
                                  : 'bg-white/10 text-text-secondary'
                              }`}>
                                {voteCount}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Chart or Anti-Bandwagon Waiting Shield */}
                  {!questionRevealed && hideLiveBreakdown ? (
                    <div className="h-[190px] rounded-2xl bg-white/5 border border-dashed border-border flex flex-col items-center justify-center p-6 text-center space-y-2">
                      <div className="flex items-center gap-2 text-brand-primary-light font-extrabold text-base">
                        <Users className="w-5 h-5 animate-pulse" />
                        <span>
                          {responses.length}{totalParticipants > 0 ? ` of ${totalParticipants}` : ''} response{responses.length === 1 ? '' : 's'} locked in
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary max-w-md">
                        Vote distribution is hidden while the timer is active so students answer independently. It will reveal automatically when time expires or when you click Reveal!
                      </p>
                    </div>
                  ) : (
                    <div className="h-[190px] self-stretch">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis 
                            dataKey="name" 
                            stroke="var(--color-text-secondary)" 
                            tickLine={false} 
                            axisLine={false} 
                            style={{ fontSize: 11, fontWeight: 'bold' }} 
                          />
                          <YAxis 
                            allowDecimals={false} 
                            stroke="var(--color-text-secondary)" 
                            tickLine={false} 
                            axisLine={false} 
                            style={{ fontSize: 11 }} 
                          />
                          <Bar dataKey="votes" radius={[12, 12, 0, 0]} barSize={40}>
                            {getChartData().map((entry: any, index: number) => {
                              const optionId = entry.name.split(' ')[1]
                              let barColor = 'var(--color-brand-primary-light)'
                              
                              if (questionRevealed) {
                                if (optionId === activeQuestion.correct_option_id) {
                                  barColor = 'var(--color-brand-success)'
                                } else {
                                  barColor = 'var(--color-brand-error)'
                                }
                              }

                              return <Cell key={`cell-${index}`} fill={barColor} />
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ) : (
                /* Open-Ended Responses: Word Cloud (with Anonymized Live Mode) or Individual Cards */
                <div className="flex-grow min-h-[260px] max-h-[320px] overflow-y-auto pr-1 flex flex-col justify-center">
                  {responses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-text-secondary text-xs py-8">
                      <Users className="w-10 h-10 text-border mb-2 animate-bounce" />
                      <span>Waiting for students to type their answers...</span>
                    </div>
                  ) : openEndedViewMode === 'cloud' ? (
                    <div className="p-6 rounded-2xl bg-white/5 border border-border/60 flex flex-wrap items-center justify-center gap-3 sm:gap-4 min-h-[240px] content-center">
                      {(() => {
                        const cloudItems = getWordCloudData()
                        const maxCount = Math.max(...cloudItems.map(i => i.count), 1)
                        const isMasked = !questionRevealed && hideLiveBreakdown

                        return cloudItems.map((item, idx) => {
                          // Scale font size dynamically between 0.95rem and 2.5rem based on frequency
                          const ratio = maxCount > 1 ? (item.count - 1) / (maxCount - 1) : 0.5
                          const fontSizeRem = 0.95 + ratio * 1.45
                          const maskedLabel = item.displayText.replace(/[^\s]/g, '•')

                          return (
                            <div
                              key={idx}
                              style={{ fontSize: `${fontSizeRem.toFixed(2)}rem` }}
                              className={`px-4 py-2 rounded-2xl border font-black transition-all duration-500 flex items-center gap-2 shadow-sm ${
                                questionRevealed
                                  ? item.isCorrect
                                    ? 'bg-brand-success/20 border-brand-success text-brand-success scale-105 shadow-brand-success/15'
                                    : 'bg-brand-error/10 border-brand-error/30 text-brand-error/80'
                                  : isMasked
                                  ? 'bg-brand-primary/15 border-brand-primary/30 text-brand-primary-light'
                                  : 'bg-white/10 border-border text-text-primary'
                              }`}
                              title={
                                questionRevealed
                                  ? `Submitted by: ${item.nicknames.join(', ')}`
                                  : isMasked
                                  ? 'Answer text hidden until reveal — size shows popularity!'
                                  : `${item.count} submission(s)`
                              }
                            >
                              <span className={isMasked ? 'tracking-widest select-none blur-[4px]' : ''}>
                                {isMasked ? maskedLabel : item.displayText}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-extrabold ${
                                questionRevealed && item.isCorrect
                                  ? 'bg-brand-success text-white'
                                  : 'bg-white/10 text-text-secondary'
                              }`}>
                                ×{item.count}
                              </span>
                            </div>
                          )
                        })
                      })()}
                      {!questionRevealed && hideLiveBreakdown && (
                        <div className="w-full text-center pt-2 text-[11px] text-text-secondary">
                          ✨ Live Word Cloud: Bubble size grows with matching answers! Words unblur on reveal.
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Individual Student Answer Cards */
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 align-content-start self-stretch">
                      {responses.map((r) => {
                        const isMasked = !questionRevealed && hideLiveBreakdown
                        return (
                          <div
                            key={r.id}
                            className={`p-3.5 rounded-xl border text-center font-bold text-xs truncate transition-all duration-300 ${
                              questionRevealed
                                ? r.is_correct
                                  ? 'bg-brand-success/20 border-brand-success text-brand-success'
                                  : 'bg-brand-error/10 border-brand-error/30 text-brand-error/80'
                                : 'bg-white/5 dark:bg-white/5 border-border text-text-primary'
                            }`}
                          >
                            <span className="text-[10px] text-text-secondary/60 block font-normal truncate uppercase tracking-widest mb-1">
                              {r.nickname}
                            </span>
                            <span className={isMasked ? 'blur-[4px] select-none tracking-widest text-brand-primary-light' : ''}>
                              {isMasked ? '••••••' : r.answer?.text}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Reveal explanation footer */}
              {questionRevealed && (
                <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border flex items-center justify-between text-xs gap-4">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Check className="w-4 h-4 text-brand-success" />
                    <span className="font-semibold text-text-secondary">Correct Answer:</span>
                  </div>
                  <span className="font-black text-brand-success truncate">
                    {activeQuestion.type === 'multiple_choice'
                      ? `Option ${activeQuestion.correct_option_id}${matchedCorrectOption?.text ? ` — ${matchedCorrectOption.text}` : ''}`
                      : activeQuestion.correct_option_id}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
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
