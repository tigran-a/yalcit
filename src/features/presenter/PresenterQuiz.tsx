import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Award, Clock, ArrowRight, Check, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from 'recharts'
import confetti from 'canvas-confetti'
import { supabase } from '../../lib/supabaseClient'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useAuth } from '../../contexts/AuthContext'

interface StudentResponse {
  id: string
  answer: { option_id?: string; text?: string }
  is_correct: boolean
  nickname: string
  user_id: string
}

interface ScoreboardEntry {
  nickname: string
  score: number
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

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Question Controller States
  const [timeLeft, setTimeLeft] = useState(30)
  const [timerActive, setTimerActive] = useState(false)
  const [questionRevealed, setQuestionRevealed] = useState(false)
  const [showScoreboard, setShowScoreboard] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  const timerRef = useRef<any>(null)

  const activeQuestion = questions[currentQuestionIndex]

  // 1. Initial Load of session, questions, and scoreboard state
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

        // Fetch questions order
        const { data: questionsData, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('quiz_id', session.quiz_id)
          .order('sort_order', { ascending: true })

        if (qErr || !questionsData || questionsData.length === 0) {
          throw new Error('No questions found in this session.')
        }

        setQuestions(questionsData)

        // Find currently active index in database
        const dbActiveIdx = questionsData.findIndex(q => q.id === session.current_question_id)
        const activeIdx = dbActiveIdx !== -1 ? dbActiveIdx : 0
        setCurrentQuestionIndex(activeIdx)

        // Start countdown timer
        const currentQ = questionsData[activeIdx]
        setTimeLeft(currentQ.time_limit)
        setTimerActive(!session.current_question_revealed)

        // Fetch current responses for this active question in THIS session
        const { data: currentResponses } = await supabase
          .from('responses')
          .select('id, answer, is_correct, nickname, user_id')
          .eq('session_id', session.id)
          .eq('question_id', currentQ.id)

        setResponses(currentResponses || [])

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
  }, [code])

  // 2. Real-time changes subscription for incoming student responses
  useEffect(() => {
    if (!activeQuestion || !sessionId) return

    // Fetch current responses for active question in this session
    const fetchQuestionResponses = async () => {
      const { data } = await supabase
        .from('responses')
        .select('id, answer, is_correct, nickname, user_id')
        .eq('session_id', sessionId)
        .eq('question_id', activeQuestion.id)

      if (data) setResponses(data)
    }

    fetchQuestionResponses()

    // Subscribe to responses INSERTs for this active question in this session
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
          setResponses(prev => {
            // Deduplicate (safeguard)
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

  // 3. Countdown timer logic
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false)
      handleCloseQuestionAndReveal() // Auto reveal correct answers when timer finishes
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
      // Set session column current_question_revealed = true
      const { error: revealErr } = await supabase
        .from('sessions')
        .update({ current_question_revealed: true })
        .eq('id', sessionId)

      if (revealErr) throw revealErr
      setQuestionRevealed(true)

      // Play sound or fire confetti if open-ended/mcq answers exist
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 }
      })

      // Reload responses from DB to ensure grading is evaluated by DB trigger
      const { data: gradedResponses, error: reloadErr } = await supabase
        .from('responses')
        .select('id, answer, is_correct, nickname, user_id')
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

    // Map each choice options to count submissions
    return activeQuestion.options.map((opt: any) => {
      const voteCount = responses.filter(r => r.answer?.option_id === opt.id).length
      return {
        name: `Option ${opt.id}`,
        votes: voteCount,
        optionText: opt.text
      }
    })
  }

  // Aggregate global scoreboard scores across all questions in the session
  const fetchScoreboard = async () => {
    if (!sessionId) return
    try {
      // Calculate sums of correct responses per student
      const { data, error: scoreErr } = await supabase
        .from('responses')
        .select('nickname, is_correct')
        .eq('session_id', sessionId)

      if (scoreErr) throw scoreErr

      const sums: Record<string, number> = {}
      data.forEach((r: any) => {
        if (!sums[r.nickname]) sums[r.nickname] = 0
        if (r.is_correct) sums[r.nickname] += 100 // +100 points for correct answer
      })

      const board: ScoreboardEntry[] = Object.keys(sums).map(key => ({
        nickname: key,
        score: sums[key]
      }))

      // Sort descending
      board.sort((a, b) => b.score - a.score)
      setScoreboard(board)
      setShowScoreboard(true)

    } catch (err) {
      console.error('Error fetching scoreboard:', err)
    }
  }

  // Navigate to next question or end the quiz session
  const handleNext = async () => {
    if (!sessionId) return
    
    const nextIndex = currentQuestionIndex + 1

    if (nextIndex < questions.length) {
      // Proceed to next question index
      const nextQuestion = questions[nextIndex]
      setLoading(true)

      try {
        // Update database with new active question id and reset reveal flag
        const { error: nextErr } = await supabase
          .from('sessions')
          .update({
            current_question_id: nextQuestion.id,
            current_question_revealed: false
          })
          .eq('id', sessionId)

        if (nextErr) throw nextErr

        // Update local presenter states
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

        // Fire giant victory confetti
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.5 }
        })

        // Fetch final scoreboard standing
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

  return (
    <div className="relative flex flex-col min-h-screen p-6 bg-bg text-text-primary transition-colors duration-300">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold bg-white/5 dark:bg-white/5 border border-border px-3 py-1.5 rounded-full text-text-secondary select-none">
            Room Code: <span className="text-brand-accent font-mono font-bold select-all cursor-pointer">{code?.toUpperCase()}</span>
          </span>
          <span className="text-xs font-bold text-text-secondary">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-white/5 dark:bg-white/5 border border-border px-3 py-1.5 rounded-full text-text-secondary text-xs font-semibold">
            <Users className="w-4 h-4 text-brand-primary-light" />
            <span>{responses.length} Answered</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Board projections */}
      <main className="relative z-10 w-full max-w-5xl mx-auto flex-grow flex flex-col justify-center">
        
        {showScoreboard ? (
          /* SCOREBOARD OVERLAY SCREEN */
          <div className="p-8 rounded-3xl glass-panel animate-glow space-y-6 max-w-lg mx-auto w-full">
            <div className="text-center space-y-2">
              <Award className="w-12 h-12 text-brand-accent mx-auto animate-bounce" />
              <h2 className="text-3xl font-black text-gradient">Leaderboard Standings</h2>
              <p className="text-xs text-text-secondary">Current scores across all rounds</p>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {scoreboard.map((entry, idx) => (
                <div
                  key={entry.nickname}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 dark:bg-white/5 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold ${
                      idx === 0 
                        ? 'bg-brand-warning/20 text-brand-warning' 
                        : idx === 1
                        ? 'bg-text-secondary/20 text-text-secondary'
                        : 'bg-white/5 text-text-secondary/50'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="font-bold text-text-primary">{entry.nickname}</span>
                  </div>
                  <span className="font-black text-brand-primary-light font-mono">{entry.score} pts</span>
                </div>
              ))}

              {scoreboard.length === 0 && (
                <div className="text-center p-6 text-text-secondary text-xs">
                  No scores recorded yet.
                </div>
              )}
            </div>

            <div className="flex justify-center pt-4">
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
                  Back to Dashboard
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
                  <div className="flex items-center gap-3 bg-white/5 dark:bg-white/5 border border-border p-4 rounded-2xl justify-center">
                    <Clock className="w-6 h-6 text-brand-accent animate-pulse" />
                    <span className="text-3xl font-black font-mono text-text-primary">
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
                <div className="space-y-2">
                  {!questionRevealed ? (
                    <button
                      onClick={handleCloseQuestionAndReveal}
                      className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-brand-primary/10"
                    >
                      Close & Reveal Correct Answer
                    </button>
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

            {/* Right Interactive Chart Visualizer (Col span 2) */}
            <div className="md:col-span-2 p-8 rounded-3xl glass-panel flex flex-col justify-between space-y-6">
              <h3 className="text-sm font-bold text-text-primary">Live Response Distribution</h3>

              {activeQuestion.type === 'multiple_choice' ? (
                /* Chart for Multiple Choice */
                <div className="flex-grow h-[260px] self-stretch">
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
                          const optionId = entry.name.split(' ')[1] // Get option letters A, B, C, D
                          let barColor = 'rgba(255, 255, 255, 0.15)' // default unrevealed
                          
                          if (questionRevealed) {
                            if (optionId === activeQuestion.options.find((opt: any) => opt.id === activeQuestion.correct_option_id)?.id) {
                              barColor = 'var(--color-brand-success)' // Correct color
                            } else {
                              barColor = 'var(--color-brand-error)' // Incorrect color
                            }
                          } else {
                            barColor = 'var(--color-brand-primary-light)' // default active unrevealed
                          }

                          return <Cell key={`cell-${index}`} fill={barColor} />
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* Text list for Open Ended answers */
                <div className="flex-grow max-h-[260px] overflow-y-auto pr-1 grid grid-cols-2 gap-2 align-content-start self-stretch">
                  {responses.map((r) => (
                    <div
                      key={r.id}
                      className={`p-3.5 rounded-xl border text-center font-bold text-xs truncate transition-all duration-300 ${
                        questionRevealed
                          ? r.is_correct
                            ? 'bg-brand-success/20 border-brand-success text-brand-success'
                            : 'bg-brand-error/10 border-brand-error/30 text-brand-error/80'
                          : 'bg-white/5 dark:bg-white/5 border-border hover:border-brand-primary/30 text-text-primary'
                      }`}
                    >
                      <span className="text-[10px] text-text-secondary/50 block font-normal truncate uppercase tracking-widest mb-1">
                        {r.nickname}
                      </span>
                      {r.answer?.text}
                    </div>
                  ))}

                  {responses.length === 0 && (
                    <div className="col-span-2 flex flex-col items-center justify-center h-full text-text-secondary text-xs py-8">
                      <Users className="w-10 h-10 text-border mb-2 animate-bounce" />
                      <span>No answers submitted yet.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reveal explanation footer */}
              {questionRevealed && (
                <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-brand-success" />
                    <span className="font-semibold text-text-secondary">Correct Answer:</span>
                  </div>
                  <span className="font-black text-brand-success uppercase">
                    {activeQuestion.type === 'multiple_choice'
                      ? `Option ${activeQuestion.correct_option_id}`
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
