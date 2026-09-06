import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Clock, CheckCircle2, XCircle, Smile } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { ThemeToggle } from '../../components/ThemeToggle'

type StudentFlowState = 'answering' | 'submitted' | 'revealed' | 'ended'

export const StudentQuiz: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()

  // Session Data States
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)

  // Student Answering States
  const [flowState, setFlowState] = useState<StudentFlowState>('answering')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [openText, setOpenText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [timerActive, setTimerActive] = useState(false)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')

  // Grading/Reveal States
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null)
  const [wasCorrect, setWasCorrect] = useState(false)
  const [pointsGained, setPointsGained] = useState(0)

  const timerRef = useRef<any>(null)
  const currentQuestionIdRef = useRef<string | null>(null)

  // 1. Fetch Session Info & Current Question Details
  const fetchActiveQuestionDetails = async (questionId: string, sessId: string) => {
    try {
      setLoading(true)
      
      // Fetch details of the active question and current session reveal status
      const [questionRes, sessionRes] = await Promise.all([
        supabase.from('questions').select('*').eq('id', questionId).single(),
        supabase.from('sessions').select('current_question_revealed').eq('id', sessId).single()
      ])

      if (questionRes.error || !questionRes.data) throw questionRes.error || new Error('Question not found')

      const question = questionRes.data
      const isRevealed = sessionRes.data?.current_question_revealed ?? false

      setActiveQuestion(question)
      currentQuestionIdRef.current = question.id
      setCurrentQuestionIndex(question.sort_order - 1)
      
      // Reset student answer inputs for the new question
      setSelectedOption(null)
      setOpenText('')
      setCorrectOptionId(null)
      setWasCorrect(false)
      setPointsGained(0)
      
      // Check if student has already submitted an answer to this question (e.g. on refresh)
      const { data: previousResponse } = await supabase
        .from('responses')
        .select('id, answer')
        .eq('question_id', questionId)
        .eq('user_id', user?.id)
        .maybeSingle()

      if (previousResponse) {
        if (question.type === 'multiple_choice') {
          setSelectedOption(previousResponse.answer?.option_id || null)
        } else {
          setOpenText(previousResponse.answer?.text || '')
        }
      }

      if (isRevealed) {
        setTimerActive(false)
        await handleRevealAnswer(questionId, sessId)
      } else if (previousResponse) {
        setTimerActive(false)
        setFlowState('submitted')
      } else {
        setTimeLeft(question.time_limit)
        setTimerActive(true)
        setFlowState('answering')
      }
      
    } catch (err: any) {
      console.error('Error fetching question details:', err)
      setError('Could not sync question details.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Initial Setup: fetch session details & join realtime updates
  useEffect(() => {
    if (authLoading) return

    if (!user || !profile) {
      if (code) {
        navigate(`/session/${code.toUpperCase()}`)
      } else {
        navigate('/')
      }
      return
    }

    if (!code) return

    let dbChannel: any = null

    const init = async () => {
      try {
        setLoading(true)
        
        // Fetch session status and current active question id
        const { data: sessionData, error: sessionErr } = await supabase
          .from('sessions')
          .select('id, quiz_id, current_question_id, status')
          .eq('code', code.toUpperCase())
          .single()

        if (sessionErr || !sessionData) {
          setError('Session not found.')
          setLoading(false)
          return
        }

        setSessionId(sessionData.id)

        // Count total questions in this quiz
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('quiz_id', sessionData.quiz_id)

        setTotalQuestions(count || 0)

        // If session is active and has a question, load details
        if (sessionData.status === 'active' && sessionData.current_question_id) {
          await fetchActiveQuestionDetails(sessionData.current_question_id, sessionData.id)
        } else if (sessionData.status === 'ended') {
          setFlowState('ended')
        }

        setLoading(false)

        // Subscribe to real-time updates on this session row
        const sessionChannelName = `student_session:${sessionData.id}`
        supabase.removeChannel(supabase.channel(sessionChannelName))
        dbChannel = supabase.channel(sessionChannelName)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'sessions',
              filter: `id=eq.${sessionData.id}`,
            },
            async (payload) => {
              const updatedSession = payload.new
              
              if (updatedSession.status === 'ended') {
                setFlowState('ended')
                setTimerActive(false)
                return
              }

              // A. Presenter navigated to a new question
              if (
                updatedSession.status === 'active' &&
                updatedSession.current_question_id &&
                updatedSession.current_question_id !== currentQuestionIdRef.current
              ) {
                await fetchActiveQuestionDetails(updatedSession.current_question_id, sessionData.id)
              }

              // B. Presenter closed question and revealed correct answer
              if (updatedSession.current_question_revealed && currentQuestionIdRef.current) {
                setTimerActive(false)
                handleRevealAnswer(currentQuestionIdRef.current, sessionData.id)
              }
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              setRealtimeStatus('connected')
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setRealtimeStatus('error')
            }
          })

      } catch (err: any) {
        console.error('Quiz initialization failed:', err)
        setError('Connection error. Please refresh.')
        setLoading(false)
      }
    }

    init()

    return () => {
      if (dbChannel) supabase.removeChannel(dbChannel)
    }
  }, [code, user, profile, authLoading, navigate])

  // 3. Countdown timer interval logic
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false)
      setFlowState(prev => (prev === 'answering' ? 'submitted' : prev))
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [timeLeft, timerActive])

  // 4. Submit student answer to database
  const handleSubmitAnswer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!sessionId || !activeQuestion || submitting || flowState !== 'answering') return

    const answerPayload =
      activeQuestion.type === 'multiple_choice'
        ? { option_id: selectedOption }
        : { text: openText.trim() }

    if (activeQuestion.type === 'multiple_choice' && !selectedOption) return
    if (activeQuestion.type === 'open_ended' && !openText.trim()) return

    setSubmitting(true)
    setTimerActive(false)

    try {
      const { error: insertErr } = await supabase.from('responses').insert({
        session_id: sessionId,
        question_id: activeQuestion.id,
        user_id: user?.id,
        nickname: profile?.display_name || 'Guest',
        answer: answerPayload,
      })

      if (insertErr) {
        // Handle duplicate error gracefully (already submitted)
        if (insertErr.code === '23505') {
          setFlowState('submitted')
        } else {
          throw insertErr
        }
      } else {
        setFlowState('submitted')
      }
    } catch (err: any) {
      console.error('Submit answer error:', err)
      setError('Could not submit answer. Please retry.')
      setTimerActive(true) // restart timer if submit fails
    } finally {
      setSubmitting(false)
    }
  }

  // 5. Fetch correct answer and grading info once revealed by presenter
  const handleRevealAnswer = async (questionId: string, _sessId: string) => {
    setTimerActive(false)
    try {
      // A. Fetch correct answer (unlocked by RLS now that session.current_question_revealed = true)
      const { data: answerData, error: answerErr } = await supabase
        .from('question_answers')
        .select('correct_option_id')
        .eq('question_id', questionId)
        .maybeSingle()

      if (answerErr) throw answerErr
      if (answerData) {
        setCorrectOptionId(answerData.correct_option_id)
      }

      // B. Fetch student's submitted response to verify grading evaluates by database trigger
      const { data: myResponse, error: responseErr } = await supabase
        .from('responses')
        .select('is_correct, points')
        .eq('question_id', questionId)
        .eq('user_id', user?.id)
        .maybeSingle()

      if (responseErr) throw responseErr
      if (myResponse) {
        setWasCorrect(myResponse.is_correct)
        setPointsGained(myResponse.points || 0)
      } else {
        setWasCorrect(false) // Did not answer in time
        setPointsGained(0)
      }
    } catch (err) {
      console.error('Error fetching correct answer reveal:', err)
    } finally {
      setFlowState('revealed')
    }
  }

  if (loading && flowState !== 'revealed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg text-text-primary transition-colors duration-300">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mb-4" />
        <p className="text-text-secondary">Syncing quiz details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-bg text-text-primary text-center transition-colors duration-300">
        <h2 className="text-2xl font-bold mb-3">Quiz Connection Lost</h2>
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
      <header className="relative z-10 w-full max-w-2xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-border">
        <span className="text-xs font-bold text-text-secondary">
          {profile?.display_name}
        </span>
        <div className="flex items-center gap-4">
          {flowState === 'answering' && activeQuestion && (
            <span className="text-xs font-semibold text-text-primary px-3 py-1.5 bg-white/5 border border-border rounded-full flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
              {timeLeft}s
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main View Port */}
      <main className="relative z-10 w-full max-w-2xl mx-auto flex-grow flex flex-col justify-center">
        {flowState === 'answering' && activeQuestion && (
          /* Answering Options Input screen */
          <div className="space-y-8 p-8 rounded-3xl glass-panel animate-glow">
            <div className="text-center space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-primary-light">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
              <h2 className="text-2xl font-black text-text-primary leading-snug">{activeQuestion.title}</h2>
              {activeQuestion.image_url && (
                <div className="relative w-full max-w-md mx-auto aspect-video rounded-2xl overflow-hidden border border-border bg-slate-100 dark:bg-white/5 shadow-md flex items-center justify-center">
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

            {activeQuestion.type === 'multiple_choice' ? (
              /* MCQ layout */
              <div className={`grid gap-3 max-w-md mx-auto ${
                activeQuestion.options.some((o: any) => o.image_url) ? 'grid-cols-2' : 'grid-cols-1'
              }`}>
                {activeQuestion.options.map((opt: any) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOption(opt.id)}
                    className={`p-3 rounded-2xl border text-left font-bold text-text-primary transition-all duration-200 cursor-pointer flex flex-col gap-2.5 ${
                      selectedOption === opt.id
                        ? 'bg-brand-primary/20 border-brand-primary text-brand-primary-light shadow-lg'
                        : 'bg-white/5 dark:bg-white/5 border-border hover:border-brand-primary/30'
                    }`}
                  >
                    {opt.image_url && (
                      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5">
                        <img 
                          src={opt.image_url} 
                          alt={`Option ${opt.id}`} 
                          className="w-full h-full object-cover" 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs flex-shrink-0 ${
                        selectedOption === opt.id
                          ? 'bg-brand-primary/30 text-text-primary'
                          : 'bg-white/5 dark:bg-white/5 text-text-secondary'
                      }`}>
                        {opt.id}
                      </span>
                      <span className="text-xs truncate">{opt.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              /* Open Ended layout */
              <form onSubmit={handleSubmitAnswer} className="max-w-md mx-auto space-y-4">
                <input
                  type="text"
                  placeholder="Type your answer here..."
                  value={openText}
                  onChange={(e) => setOpenText(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary text-center text-lg font-medium placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300"
                  maxLength={50}
                  required
                />
              </form>
            )}

            <div className="flex justify-center pt-4">
              <button
                onClick={() => handleSubmitAnswer()}
                disabled={submitting || (activeQuestion.type === 'multiple_choice' ? !selectedOption : !openText.trim())}
                className="px-8 py-3.5 font-bold rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.02] active:scale-[0.98] transition-all text-sm text-white disabled:opacity-50 disabled:scale-100 disabled:pointer-events-none cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Answer'
                )}
              </button>
            </div>
          </div>
        )}

        {flowState === 'submitted' && (
          /* Answer Submitted Waiting Screen */
          <div className="p-8 rounded-3xl glass-panel text-center space-y-6 max-w-md mx-auto w-full">
            <Loader2 className="w-12 h-12 text-brand-primary-light animate-spin mx-auto" />
            <h2 className="text-2xl font-black text-text-primary">Answer Submitted!</h2>
            <p className="text-sm text-text-secondary">
              Waiting for classmates to finish or the presenter to reveal the results...
            </p>
          </div>
        )}

        {flowState === 'revealed' && (
          /* Results/Correction Reveal Screen */
          <div className="p-8 rounded-3xl glass-panel animate-glow text-center space-y-8 max-w-md mx-auto w-full">
            {wasCorrect ? (
              <div className="space-y-4">
                <CheckCircle2 className="w-16 h-16 text-brand-success mx-auto animate-bounce" />
                <h2 className="text-3xl font-black text-brand-success">Correct!</h2>
                <p className="text-sm font-bold text-brand-success bg-brand-success/10 px-3 py-1.5 rounded-full inline-block">
                  + {pointsGained} pts!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <XCircle className="w-16 h-16 text-brand-error mx-auto" />
                <h2 className="text-3xl font-black text-brand-error">Incorrect</h2>
                <p className="text-sm text-text-secondary">
                  {selectedOption || openText.trim()
                    ? `Oops! Better luck next time.`
                    : 'Time expired! You didn\'t submit an answer.'}
                </p>
              </div>
            )}

            {correctOptionId && (() => {
              const matchedOpt = activeQuestion?.type === 'multiple_choice'
                ? activeQuestion.options?.find((o: any) => o.id === correctOptionId)
                : null

              return (
                <div className="p-5 rounded-2xl bg-white/5 dark:bg-white/5 border border-border space-y-3">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">
                    Correct Answer
                  </span>

                  {activeQuestion?.type === 'multiple_choice' ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-brand-success/20 text-brand-success font-black text-sm flex items-center justify-center border border-brand-success/30">
                          {correctOptionId}
                        </span>
                        {matchedOpt?.text && (
                          <span className="text-lg font-extrabold text-text-primary">
                            {matchedOpt.text}
                          </span>
                        )}
                      </div>

                      {matchedOpt?.image_url && (
                        <div className="relative w-full max-w-xs aspect-video rounded-xl overflow-hidden border border-border bg-slate-100 dark:bg-white/5 shadow-sm mt-1">
                          <img 
                            src={matchedOpt.image_url} 
                            alt={`Correct option ${correctOptionId}`} 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-2xl font-extrabold text-brand-success block">
                      {correctOptionId}
                    </span>
                  )}
                </div>
              )
            })()}

            <div className="flex items-center gap-3 justify-center text-xs text-text-secondary animate-pulse-slow">
              <Loader2 className="w-4 h-4 animate-spin text-brand-primary-light" />
              <span>Waiting for presenter to advance...</span>
            </div>
          </div>
        )}

        {flowState === 'ended' && (
          /* End of Quiz Screen */
          <div className="p-8 rounded-3xl glass-panel text-center space-y-6 max-w-md mx-auto w-full">
            <Smile className="w-16 h-16 text-brand-accent mx-auto animate-bounce mb-2" />
            <h2 className="text-3xl font-black text-gradient">Quiz Completed!</h2>
            <p className="text-sm text-text-secondary">
              The presenter has ended the session. Look at the main screen for the final standings and winner podium!
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 font-semibold rounded-xl bg-white/10 dark:bg-white/5 border border-border hover:bg-white/15 dark:hover:bg-white/10 transition-all text-text-primary text-sm cursor-pointer"
            >
              Back to Home
            </button>
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
