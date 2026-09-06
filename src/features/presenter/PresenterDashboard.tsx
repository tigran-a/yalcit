import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Plus, Play, LogOut, Loader2, Trash2, Award, Clock, FileText, 
  CheckCircle2, Edit2, Copy, Eye, EyeOff, Upload, Download, ExternalLink, RefreshCw, Sparkles
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { ThemeToggle } from '../../components/ThemeToggle'

interface Quiz {
  id: string
  title: string
  created_at: string
  is_public: boolean
  forked_from_id?: string | null
  presenter_id?: string
  profiles?: { display_name: string } | null
}

interface Question {
  id?: string
  type: 'multiple_choice' | 'open_ended'
  title: string
  image_url?: string
  options: { id: string; text: string; image_url?: string }[]
  time_limit: number
  correct_option_id?: string
}

export const PresenterDashboard: React.FC = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect if not authenticated as a presenter
  useEffect(() => {
    if (!authLoading) {
      if (!user || profile?.role !== 'presenter') {
        navigate('/presenter/auth')
      }
    }
  }, [user, profile, authLoading, navigate])

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [publicQuizzes, setPublicQuizzes] = useState<Quiz[]>([])
  const [activeSessions, setActiveSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quiz Creator/Editor Form States
  const [showCreator, setShowCreator] = useState(false)
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null)
  const [quizTitle, setQuizTitle] = useState('')
  const [quizIsPublic, setQuizIsPublic] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([
    {
      type: 'multiple_choice',
      title: 'What is 2 + 2?',
      image_url: '',
      options: [
        { id: 'A', text: '3' },
        { id: 'B', text: '4' },
        { id: 'C', text: '5' },
        { id: 'D', text: '6' }
      ],
      time_limit: 30,
      correct_option_id: 'B'
    }
  ])

  // Filter/tab states
  const [quizTab, setQuizTab] = useState<'mine' | 'public'>('mine')
  const [selectedQuizIds, setSelectedQuizIds] = useState<Record<string, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch all dashboard data
  const fetchData = async () => {
    if (!user) return
    try {
      setLoading(true)
      
      // 1. Fetch own quizzes
      const { data: ownData, error: ownErr } = await supabase
        .from('quizzes')
        .select('*, profiles(display_name)')
        .eq('presenter_id', user.id)
        .order('created_at', { ascending: false })

      if (ownErr) throw ownErr
      setQuizzes(ownData || [])

      // 2. Fetch public quizzes owned by OTHERS
      const { data: pubData, error: pubErr } = await supabase
        .from('quizzes')
        .select('*, profiles(display_name)')
        .eq('is_public', true)
        .neq('presenter_id', user.id)
        .order('created_at', { ascending: false })

      if (pubErr) throw pubErr
      setPublicQuizzes(pubData || [])

      // 3. Fetch active sessions (status is waiting or active)
      const { data: sessData, error: sessErr } = await supabase
        .from('sessions')
        .select('id, code, status, created_at, quizzes(title)')
        .eq('presenter_id', user.id)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false })

      if (sessErr) throw sessErr
      setActiveSessions(sessData || [])

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user])

  // Handles adding empty question fields
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        type: 'multiple_choice',
        title: '',
        image_url: '',
        options: [
          { id: 'A', text: '' },
          { id: 'B', text: '' },
          { id: 'C', text: '' },
          { id: 'D', text: '' }
        ],
        time_limit: 30,
        correct_option_id: 'A'
      }
    ])
  }

  // Handles deleting a question index
  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, idx) => idx !== index))
  }

  // Update question inputs dynamically
  const updateQuestionData = (index: number, key: keyof Question, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [key]: value }
    setQuestions(updated)
  }

  // Update question mcq option inputs
  const updateOptionText = (qIdx: number, oIdx: number, text: string) => {
    const updated = [...questions]
    const updatedOptions = [...updated[qIdx].options]
    updatedOptions[oIdx] = { ...updatedOptions[oIdx], text }
    updated[qIdx].options = updatedOptions
    setQuestions(updated)
  }

  // Submit and create/update quiz template with questions & secure answers
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || creating) return

    const title = quizTitle.trim()
    if (!title) {
      setError('Please provide a quiz title.')
      return
    }

    if (questions.length === 0) {
      setError('Please add at least one question.')
      return
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.title.trim()) {
        setError(`Question #${i + 1} title cannot be empty.`)
        return
      }
      if (q.type === 'multiple_choice') {
        const hasEmptyOption = q.options.some((opt) => !opt.text.trim())
        if (hasEmptyOption) {
          setError(`Question #${i + 1} has incomplete option labels.`)
          return
        }
      }
    }

    setCreating(true)
    setError(null)

    try {
      if (editingQuizId) {
        // 1. Update existing Quiz template row
        const { error: quizErr } = await supabase
          .from('quizzes')
          .update({
            title: title,
            is_public: quizIsPublic
          })
          .eq('id', editingQuizId)

        if (quizErr) throw quizErr

        // 2. Clear old questions (cascades to answers)
        const { error: clearErr } = await supabase
          .from('questions')
          .delete()
          .eq('quiz_id', editingQuizId)

        if (clearErr) throw clearErr

        // 3. Insert new questions
        for (let idx = 0; idx < questions.length; idx++) {
          const q = questions[idx]

          const { data: insertedQuestion, error: qErr } = await supabase
            .from('questions')
            .insert({
              quiz_id: editingQuizId,
              type: q.type,
              title: q.title.trim(),
              image_url: q.image_url?.trim() || null,
              options: q.type === 'multiple_choice' ? q.options : [],
              time_limit: q.time_limit,
              sort_order: idx + 1
            })
            .select()
            .single()

          if (qErr) throw qErr

          const { error: answerErr } = await supabase
            .from('question_answers')
            .insert({
              question_id: insertedQuestion.id,
              correct_option_id: q.type === 'multiple_choice' ? q.correct_option_id : q.correct_option_id?.trim()
            })

          if (answerErr) throw answerErr
        }

      } else {
        // 1. Insert new Quiz template row
        const { data: quizData, error: quizErr } = await supabase
          .from('quizzes')
          .insert({
            presenter_id: user.id,
            title: title,
            is_public: quizIsPublic
          })
          .select()
          .single()

        if (quizErr) throw quizErr

        // 2. Insert questions and their secure answers
        for (let idx = 0; idx < questions.length; idx++) {
          const q = questions[idx]

          // Insert question
          const { data: insertedQuestion, error: qErr } = await supabase
            .from('questions')
            .insert({
              quiz_id: quizData.id,
              type: q.type,
              title: q.title.trim(),
              image_url: q.image_url?.trim() || null,
              options: q.type === 'multiple_choice' ? q.options : [],
              time_limit: q.time_limit,
              sort_order: idx + 1
            })
            .select()
            .single()

          if (qErr) throw qErr

          // Insert secure answer row
          const { error: answerErr } = await supabase
            .from('question_answers')
            .insert({
              question_id: insertedQuestion.id,
              correct_option_id: q.type === 'multiple_choice' ? q.correct_option_id : q.correct_option_id?.trim()
            })

          if (answerErr) throw answerErr
        }
      }

      // Reset Form State
      resetForm()
      fetchData()

    } catch (err: any) {
      console.error('Quiz save error:', err)
      let displayError = err.message || 'An error occurred while saving the quiz.'
      if (displayError.includes('row-level security policy')) {
        displayError = 'Security Violation: You do not have permission to manage quizzes. If you were testing in another tab as a student, your login session was overwritten. Please logout (top right) and log back in as a presenter.'
      }
      setError(displayError)
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setQuizTitle('')
    setQuizIsPublic(false)
    setEditingQuizId(null)
    setQuestions([
      {
        type: 'multiple_choice',
        title: 'What is 2 + 2?',
        image_url: '',
        options: [
          { id: 'A', text: '3' },
          { id: 'B', text: '4' },
          { id: 'C', text: '5' },
          { id: 'D', text: '6' }
        ],
        time_limit: 30,
        correct_option_id: 'B'
      }
    ])
    setShowCreator(false)
  }

  // Image upload helpers
  const handleUploadImage = async (file: File, callback: (url: string) => void) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id || 'anonymous'}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`
      
      const { error: uploadErr } = await supabase.storage
        .from('yalcit-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadErr) throw uploadErr

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('yalcit-media')
        .getPublicUrl(fileName)

      callback(publicUrl)
    } catch (err: any) {
      console.error('Image upload failed:', err)
      alert('Failed to upload image: ' + err.message)
    }
  }

  const handleQuestionImageUpload = async (qIdx: number, file: File) => {
    await handleUploadImage(file, (url) => {
      updateQuestionData(qIdx, 'image_url', url)
    })
  }

  const handleOptionImageUpload = async (qIdx: number, oIdx: number, file: File) => {
    await handleUploadImage(file, (url) => {
      const updated = [...questions]
      const updatedOptions = [...updated[qIdx].options]
      updatedOptions[oIdx] = { ...updatedOptions[oIdx], image_url: url }
      updated[qIdx].options = updatedOptions
      setQuestions(updated)
    })
  }

  // Load quiz details for editing
  const handleEditQuiz = async (quiz: Quiz) => {
    try {
      setLoading(true)
      setError(null)
      setEditingQuizId(quiz.id)
      setQuizTitle(quiz.title)
      setQuizIsPublic(quiz.is_public)

      // Fetch questions and answers for this quiz
      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('*, question_answers(correct_option_id)')
        .eq('quiz_id', quiz.id)
        .order('sort_order', { ascending: true })

      if (qErr) throw qErr

      const mappedQuestions: Question[] = (questionsData || []).map((q: any) => {
        const correctAns = q.question_answers?.correct_option_id || 
          (Array.isArray(q.question_answers) ? q.question_answers[0]?.correct_option_id : '')

        return {
          id: q.id,
          type: q.type,
          title: q.title,
          image_url: q.image_url || '',
          options: q.options,
          time_limit: q.time_limit,
          correct_option_id: correctAns
        }
      })

      setQuestions(mappedQuestions)
      setShowCreator(true)
    } catch (err: any) {
      console.error('Error loading quiz for edit:', err)
      setError('Could not load quiz questions.')
    } finally {
      setLoading(false)
    }
  }

  // Clones a quiz (itself or a public quiz) into the user's library
  const handleDuplicateQuiz = async (quiz: Quiz) => {
    try {
      setLoading(true)
      setError(null)

      // 1. Fetch source quiz questions and answers
      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('*, question_answers(correct_option_id)')
        .eq('quiz_id', quiz.id)
        .order('sort_order', { ascending: true })

      if (qErr) throw qErr

      // 2. Create duplicated Quiz template row owned by current user
      const { data: newQuiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          presenter_id: user?.id,
          title: `${quiz.title} (Copy)`,
          is_public: false,
          forked_from_id: quiz.id
        })
        .select()
        .single()

      if (quizErr) throw quizErr

      // 3. Clone all questions and correct answers
      for (let idx = 0; idx < (questionsData || []).length; idx++) {
        const q = questionsData[idx]
        const { data: insertedQuestion, error: insertQErr } = await supabase
          .from('questions')
          .insert({
            quiz_id: newQuiz.id,
            type: q.type,
            title: q.title,
            image_url: q.image_url,
            options: q.options,
            time_limit: q.time_limit,
            sort_order: q.sort_order
          })
          .select()
          .single()

        if (insertQErr) throw insertQErr

        const correctAns = q.question_answers?.correct_option_id || 
          (Array.isArray(q.question_answers) ? q.question_answers[0]?.correct_option_id : '')

        const { error: insertAnsErr } = await supabase
          .from('question_answers')
          .insert({
            question_id: insertedQuestion.id,
            correct_option_id: correctAns
          })

        if (insertAnsErr) throw insertAnsErr
      }

      alert(`Successfully duplicated quiz: "${quiz.title}"!`)
      fetchData()

    } catch (err: any) {
      console.error('Error duplicating quiz:', err)
      setError('Could not duplicate quiz template.')
    } finally {
      setLoading(false)
    }
  }

  // Deletes an entire quiz and its corresponding storage assets
  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz? This will delete all its questions, sessions, responses, and associated uploaded images permanently.')) return

    try {
      setLoading(true)

      // 1. Gather all questions for this quiz to extract image URLs
      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('image_url, options')
        .eq('quiz_id', id)

      if (qErr) throw qErr

      const imagesToDelete: string[] = []
      if (questionsData) {
        questionsData.forEach((q: any) => {
          if (q.image_url) {
            imagesToDelete.push(q.image_url)
          }
          if (Array.isArray(q.options)) {
            q.options.forEach((opt: any) => {
              if (opt.image_url) {
                imagesToDelete.push(opt.image_url)
              }
            })
          }
        })
      }

      // 2. Delete the quiz from database (cascades to questions & sessions)
      const { error: delErr } = await supabase.from('quizzes').delete().eq('id', id)
      if (delErr) throw delErr

      // 3. For each image, check if it's used elsewhere, and delete if orphan
      for (const imgUrl of imagesToDelete) {
        if (!imgUrl.includes('/storage/v1/object/public/yalcit-media/')) continue

        // Check if still used in other questions (active question image)
        const { data: qUsage } = await supabase
          .from('questions')
          .select('id')
          .eq('image_url', imgUrl)
          .limit(1)

        if (qUsage && qUsage.length > 0) continue

        // Check if still used in options (MCQ option images)
        const { data: optUsage } = await supabase
          .from('questions')
          .select('id')
          .contains('options', [{ image_url: imgUrl }])
          .limit(1)

        if (optUsage && optUsage.length > 0) continue

        // Extract filename from URL path and delete from storage
        const pathParts = imgUrl.split('/yalcit-media/')
        if (pathParts.length > 1) {
          const filePath = pathParts[1]
          const { error: storageDelErr } = await supabase.storage
            .from('yalcit-media')
            .remove([filePath])
          if (storageDelErr) {
            console.error('Failed to delete storage file:', filePath, storageDelErr)
          }
        }
      }

      setQuizzes(quizzes.filter((q) => q.id !== id))
      fetchData()
    } catch (err: any) {
      console.error('Delete error:', err)
      alert('Could not delete quiz: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Hosting modal states
  const [hostModalQuiz, setHostModalQuiz] = useState<any | null>(null)
  const [speedScoringOption, setSpeedScoringOption] = useState<boolean>(true)

  // Opens host modal for session configuration
  const handleHostQuiz = (quizId: string) => {
    const targetQuiz = [...quizzes, ...publicQuizzes].find(q => q.id === quizId)
    if (targetQuiz) {
      setHostModalQuiz(targetQuiz)
      setSpeedScoringOption(true)
    }
  }

  // Spawns a new active session for a quiz
  const executeHostQuiz = async (quizId: string, speedScoring: boolean) => {
    if (!user) return
    try {
      setLoading(true)
      
      // 1. Generate unique 6-character room code (uppercase)
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      // 2. Insert Session row pointing to this quiz template
      const { error: sessionErr } = await supabase
        .from('sessions')
        .insert({
          code: roomCode,
          quiz_id: quizId,
          presenter_id: user.id,
          status: 'waiting',
          speed_scoring: speedScoring,
          current_question_started_at: new Date().toISOString()
        })

      if (sessionErr) throw sessionErr

      setHostModalQuiz(null)
      // 3. Navigate to lobby
      navigate(`/presenter/session/${roomCode}/lobby`)

    } catch (err: any) {
      console.error('Host quiz error:', err)
      let displayError = err.message || 'Could not start session.'
      if (displayError.includes('row-level security policy')) {
        displayError = 'Security Violation: Cannot start session. Your presenter session has expired. Please sign out and sign back in.'
      }
      alert(displayError)
    } finally {
      setLoading(false)
    }
  }

  // Terminate a live ongoing session
  const handleTerminateSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to terminate this live session? All active students will be disconnected.')) return
    try {
      const { error: updateErr } = await supabase
        .from('sessions')
        .update({ status: 'ended' })
        .eq('id', sessionId)

      if (updateErr) throw updateErr
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err) {
      console.error('Terminate session error:', err)
      alert('Could not terminate session.')
    }
  }

  // Toggle quiz privacy settings
  const handleTogglePrivacy = async (quiz: Quiz) => {
    try {
      const newPublicStatus = !quiz.is_public
      const { error: updateErr } = await supabase
        .from('quizzes')
        .update({ is_public: newPublicStatus })
        .eq('id', quiz.id)

      if (updateErr) throw updateErr
      fetchData()
    } catch (err) {
      console.error('Privacy toggle error:', err)
      alert('Could not update quiz privacy settings.')
    }
  }

  // Multi-select helpers
  const handleToggleSelectQuiz = (id: string) => {
    setSelectedQuizIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleSelectAllQuizzes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    const nextIds: Record<string, boolean> = {}
    if (checked) {
      quizzes.forEach(q => {
        nextIds[q.id] = true
      })
    }
    setSelectedQuizIds(nextIds)
  }

  // Single or Bulk JSON Export
  const handleExportSelected = async () => {
    const selectedIds = Object.keys(selectedQuizIds).filter(id => selectedQuizIds[id])
    if (selectedIds.length === 0) {
      alert('Please select at least one quiz to export.')
      return
    }

    try {
      setLoading(true)
      const exportedData = []

      for (const id of selectedIds) {
        const { data: quiz, error: qzErr } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', id)
          .single()

        if (qzErr) throw qzErr

        const { data: questionsData, error: qErr } = await supabase
          .from('questions')
          .select('*, question_answers(correct_option_id)')
          .eq('quiz_id', id)
          .order('sort_order', { ascending: true })

        if (qErr) throw qErr

        const mappedQuestions = (questionsData || []).map((q: any) => {
          const correctAns = q.question_answers?.correct_option_id || 
            (Array.isArray(q.question_answers) ? q.question_answers[0]?.correct_option_id : '')

          return {
            type: q.type,
            title: q.title,
            image_url: q.image_url || null,
            options: q.options,
            time_limit: q.time_limit,
            sort_order: q.sort_order,
            correct_option_id: correctAns
          }
        })

        exportedData.push({
          title: quiz.title,
          is_public: quiz.is_public,
          questions: mappedQuestions
        })
      }

      const jsonStr = JSON.stringify(exportedData, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `yalcit_quizzes_export_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

    } catch (err: any) {
      console.error('Export failed:', err)
      alert('Could not export quizzes. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // JSON File Import
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      setLoading(true)
      const reader = new FileReader()
      
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string
          const parsed = JSON.parse(content)
          
          if (!Array.isArray(parsed)) {
            throw new Error('Invalid format: File content must be an array of quizzes.')
          }

          let importCount = 0
          for (const item of parsed) {
            if (!item.title || !Array.isArray(item.questions)) {
              console.warn('Skipping invalid quiz entry during import:', item)
              continue
            }

            // 1. Insert Quiz template
            const { data: newQuiz, error: qzErr } = await supabase
              .from('quizzes')
              .insert({
                presenter_id: user.id,
                title: item.title,
                is_public: !!item.is_public
              })
              .select()
              .single()

            if (qzErr) throw qzErr

            // 2. Insert questions + answers
            for (let idx = 0; idx < item.questions.length; idx++) {
              const q = item.questions[idx]
              const { data: insertedQuestion, error: qErr } = await supabase
                .from('questions')
                .insert({
                  quiz_id: newQuiz.id,
                  type: q.type || 'multiple_choice',
                  title: q.title || 'Untitled Question',
                  image_url: q.image_url || null,
                  options: q.options || [],
                  time_limit: q.time_limit || 30,
                  sort_order: q.sort_order || (idx + 1)
                })
                .select()
                .single()

              if (qErr) throw qErr

              if (q.correct_option_id) {
                const { error: ansErr } = await supabase
                  .from('question_answers')
                  .insert({
                    question_id: insertedQuestion.id,
                    correct_option_id: q.correct_option_id
                  })

                if (ansErr) throw ansErr
              }
            }
            importCount++
          }

          alert(`Successfully imported ${importCount} quizzes!`)
          fetchData()

        } catch (err: any) {
          console.error('Import parse failed:', err)
          alert('Could not parse import file: ' + err.message)
        }
      }

      reader.readAsText(file)

    } catch (err: any) {
      console.error('Import failed:', err)
      alert('Could not read file.')
    } finally {
      setLoading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleLogOut = async () => {
    await signOut()
    navigate('/presenter/auth')
  }

  const selectedCount = Object.keys(selectedQuizIds).filter(id => selectedQuizIds[id]).length

  return (
    <div className="relative flex flex-col min-h-screen p-6 bg-bg text-text-primary transition-colors duration-300">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between mb-10 pb-4 border-b border-border">
        <div className="flex flex-col">
          <span className="text-xl font-extrabold tracking-wider text-gradient">YALCIT</span>
          <span className="text-[10px] text-text-secondary uppercase tracking-widest mt-0.5">
            Presenter: {profile?.display_name || 'Administrator'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData} 
            className="p-2 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-text-primary transition-all cursor-pointer"
            title="Refresh Dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <ThemeToggle />
          <button
            onClick={handleLogOut}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white/5 border border-border hover:bg-brand-error/15 hover:border-brand-error/30 hover:text-brand-error transition-all cursor-pointer active:scale-95 text-text-primary"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Grid content */}
      <main className="relative z-10 w-full max-w-6xl mx-auto flex-grow grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Active Sessions & Quizzes List */}
        <div className="lg:col-span-1 space-y-6 self-start">
          
          {/* 1. Ongoing Active Sessions Panel */}
          {activeSessions.length > 0 && (
            <div className="p-6 rounded-3xl glass-panel space-y-4 border border-brand-primary/20 bg-brand-primary/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-brand-accent rounded-full animate-ping" />
                <h2 className="text-sm font-extrabold text-text-primary">Ongoing Sessions</h2>
              </div>
              
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {activeSessions.map((sess) => (
                  <div 
                    key={sess.id} 
                    className="p-3 rounded-xl bg-white/5 dark:bg-white/5 border border-border/60 hover:border-brand-primary/40 flex items-center justify-between transition-all duration-300 text-xs"
                  >
                    <div className="space-y-1 truncate pr-2">
                      <div className="font-extrabold text-text-primary truncate">
                        {sess.quizzes?.title || 'Untitled Quiz'}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded font-bold text-[10px] text-brand-primary-light select-all cursor-pointer">
                          {sess.code}
                        </span>
                        <span className={`capitalize font-bold text-[9px] ${
                          sess.status === 'active' ? 'text-brand-success' : 'text-brand-warning'
                        }`}>
                          {sess.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => navigate(sess.status === 'waiting' 
                          ? `/presenter/session/${sess.code}/lobby` 
                          : `/presenter/session/${sess.code}/quiz`
                        )}
                        className="px-2.5 py-1 rounded bg-brand-primary text-white font-bold text-[10px] hover:scale-[1.03] transition-all cursor-pointer"
                        title="Resume Hosting"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => handleTerminateSession(sess.id)}
                        className="p-1 rounded hover:bg-brand-error/15 text-text-secondary hover:text-brand-error transition-all cursor-pointer"
                        title="Terminate Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Quizzes Manager Panel */}
          <div className="p-6 rounded-3xl glass-panel space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setQuizTab('mine')}
                  className={`text-xs font-bold pb-1.5 border-b-2 transition-all cursor-pointer ${
                    quizTab === 'mine' 
                      ? 'border-brand-accent text-text-primary' 
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  My Quizzes
                </button>
                <button
                  onClick={() => setQuizTab('public')}
                  className={`text-xs font-bold pb-1.5 border-b-2 transition-all cursor-pointer ${
                    quizTab === 'public' 
                      ? 'border-brand-accent text-text-primary' 
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Public Shared
                </button>
              </div>
              <button
                onClick={() => {
                  resetForm()
                  setShowCreator(!showCreator)
                }}
                className="p-1.5 rounded-lg bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.05] transition-all shadow-md flex items-center justify-center cursor-pointer text-white"
                title="Create Quiz template"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Bulk Export & Import Controls */}
            {quizTab === 'mine' && quizzes.length > 0 && (
              <div className="flex items-center justify-between bg-white/5 border border-border p-2.5 rounded-xl text-[10px] gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-text-secondary">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAllQuizzes} 
                    checked={quizzes.length > 0 && selectedCount === quizzes.length}
                    className="rounded text-brand-primary" 
                  />
                  <span>Select ({selectedCount})</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportSelected}
                    disabled={selectedCount === 0}
                    className="px-2 py-1 rounded bg-white/5 border border-border hover:bg-white/10 text-text-primary disabled:opacity-30 transition-all font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 rounded bg-white/5 border border-border hover:bg-white/10 text-text-primary transition-all font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    Import
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportFile}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Quizzes List */}
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
              {/* Own Quizzes */}
              {quizTab === 'mine' && quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="p-3.5 rounded-2xl bg-white/5 dark:bg-white/5 border border-border hover:border-brand-primary/30 flex items-center justify-between transition-all duration-300 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0 pr-2">
                    <input 
                      type="checkbox"
                      checked={!!selectedQuizIds[quiz.id]}
                      onChange={() => handleToggleSelectQuiz(quiz.id)}
                      className="mt-1 rounded text-brand-primary"
                    />
                    <div className="space-y-1 truncate">
                      <h3 className="font-extrabold text-text-primary truncate">
                        {quiz.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[9px] text-text-secondary">
                        <span className="flex items-center gap-0.5">
                          {quiz.is_public ? (
                            <>
                              <Eye className="w-2.5 h-2.5 text-brand-success" />
                              Public
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-2.5 h-2.5 text-text-secondary/50" />
                              Private
                            </>
                          )}
                        </span>
                        {quiz.forked_from_id && (
                          <span className="text-brand-accent/70 font-semibold italic">Forked</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleHostQuiz(quiz.id)}
                      className="p-1.5 rounded hover:bg-brand-success/15 text-brand-success transition-all cursor-pointer"
                      title="Host Session"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEditQuiz(quiz)}
                      className="p-1.5 rounded hover:bg-brand-primary/15 text-brand-primary transition-all cursor-pointer"
                      title="Edit Quiz"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleTogglePrivacy(quiz)}
                      className="p-1.5 rounded hover:bg-white/10 text-text-primary transition-all cursor-pointer"
                      title={quiz.is_public ? "Make Private" : "Make Public"}
                    >
                      {quiz.is_public ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDuplicateQuiz(quiz)}
                      className="p-1.5 rounded hover:bg-white/10 text-text-primary transition-all cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="p-1.5 rounded hover:bg-brand-error/15 text-brand-error transition-all cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Public Quizzes */}
              {quizTab === 'public' && publicQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="p-3.5 rounded-2xl bg-white/5 dark:bg-white/5 border border-border hover:border-brand-primary/30 flex items-center justify-between transition-all duration-300 text-xs"
                >
                  <div className="space-y-1 truncate pr-3">
                    <h3 className="font-extrabold text-text-primary truncate">
                      {quiz.title}
                    </h3>
                    <div className="flex flex-col gap-0.5 text-[9px] text-text-secondary">
                      <span>By: {quiz.profiles?.display_name || 'Presenter'}</span>
                      {quiz.forked_from_id && <span className="italic text-brand-accent/50">Derived Quiz</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleHostQuiz(quiz.id)}
                      className="p-1.5 rounded hover:bg-brand-success/15 text-brand-success transition-all cursor-pointer flex items-center gap-1 font-bold"
                      title="Host Session"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Host</span>
                    </button>
                    <button
                      onClick={() => handleDuplicateQuiz(quiz)}
                      className="p-1.5 rounded hover:bg-white/10 text-text-primary transition-all cursor-pointer flex items-center gap-1 font-semibold"
                      title="Duplicate to My Quizzes"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicate</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Empty States */}
              {quizTab === 'mine' && quizzes.length === 0 && !loading && (
                <div className="text-center p-8 rounded-2xl border border-dashed border-border text-text-secondary">
                  <FileText className="w-8 h-8 text-border mx-auto mb-2" />
                  <p className="text-xs">No quizzes templates created yet. Click the + button!</p>
                </div>
              )}

              {quizTab === 'public' && publicQuizzes.length === 0 && !loading && (
                <div className="text-center p-8 rounded-2xl border border-dashed border-border text-text-secondary">
                  <ExternalLink className="w-8 h-8 text-border mx-auto mb-2" />
                  <p className="text-xs">No public quiz templates shared by others yet.</p>
                </div>
              )}

              {loading && (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-primary-light" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Creator / Editor Panel */}
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm animate-pulse-slow">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 rotate-180 text-brand-error" />
              <span>{error}</span>
            </div>
          )}

          {showCreator ? (
            /* Quiz Creator / Editor Form */
            <form onSubmit={handleCreateQuiz} className="p-8 rounded-3xl glass-panel animate-glow space-y-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h2 className="text-lg font-black text-text-primary">
                  {editingQuizId ? 'Edit Quiz Template' : 'Create New Quiz Template'}
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                  Quiz Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Math Trivia"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300 font-bold"
                  required
                />
              </div>

              {/* Privacy checkbox */}
              <div className="flex items-center gap-3 bg-white/5 border border-border p-4 rounded-2xl">
                <input
                  type="checkbox"
                  id="quizIsPublic"
                  checked={quizIsPublic}
                  onChange={(e) => setQuizIsPublic(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary cursor-pointer"
                />
                <div className="select-none cursor-pointer flex flex-col">
                  <label htmlFor="quizIsPublic" className="text-xs font-bold text-text-primary cursor-pointer">
                    Share Quiz Publicly
                  </label>
                  <span className="text-[10px] text-text-secondary">
                    Allow all presenters to duplicate and play this quiz in their own active classrooms.
                  </span>
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-primary">Quiz Questions</h3>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-border hover:bg-white/10 text-xs font-semibold transition-all cursor-pointer text-text-primary"
                  >
                    <Plus className="w-3.5 h-3.5 text-brand-accent" />
                    Add Question
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="p-6 rounded-2xl bg-white/5 dark:bg-white/5 border border-border space-y-5 relative">
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIdx)}
                      className="absolute top-4 right-4 p-1.5 text-text-secondary hover:text-brand-error transition-all cursor-pointer"
                      title="Remove Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Question Header & Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">
                          Question #{qIdx + 1} Text
                        </label>
                        <input
                          type="text"
                          placeholder="Type your question prompt..."
                          value={q.title}
                          onChange={(e) => updateQuestionData(qIdx, 'title', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all text-sm font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">
                          Type
                        </label>
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestionData(qIdx, 'type', e.target.value as any)}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border text-text-primary text-sm focus:outline-none focus:border-brand-primary/50 transition-all font-semibold"
                        >
                          <option className="bg-bg text-text-primary" value="multiple_choice">Multiple Choice</option>
                          <option className="bg-bg text-text-primary" value="open_ended">Open Ended</option>
                        </select>
                      </div>
                    </div>

                    {/* Question Image URL & Upload */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                        Question Image (Optional)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          placeholder="e.g. https://images.unsplash.com/photo-12345..."
                          value={q.image_url || ''}
                          onChange={(e) => updateQuestionData(qIdx, 'image_url', e.target.value)}
                          className="flex-grow px-4 py-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all text-xs font-semibold"
                        />
                        <label className="flex-shrink-0 cursor-pointer px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-border text-xs font-bold text-text-primary flex items-center gap-1.5 transition-all">
                          <Upload className="w-4 h-4 text-brand-accent" />
                          <span>Upload File</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                handleQuestionImageUpload(qIdx, file)
                              }
                            }}
                          />
                        </label>
                        {q.image_url && (
                          <button
                            type="button"
                            onClick={() => updateQuestionData(qIdx, 'image_url', '')}
                            className="px-3 py-2.5 rounded-xl bg-brand-error/10 hover:bg-brand-error/20 border border-brand-error/30 text-xs font-bold text-brand-error cursor-pointer transition-all"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Options list for Multiple Choice */}
                    {q.type === 'multiple_choice' ? (
                      <div className="space-y-3">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                          Answer Options & Correct Selection
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.options.map((opt, oIdx) => (
                            <div key={opt.id} className="space-y-2 p-3 rounded-xl bg-white/5 border border-border/50">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateQuestionData(qIdx, 'correct_option_id', opt.id)}
                                  className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer ${
                                    q.correct_option_id === opt.id
                                      ? 'bg-brand-success/20 border-brand-success text-brand-success shadow-md shadow-brand-success/15'
                                      : 'bg-white/5 dark:bg-white/5 border-border hover:border-brand-success/40 text-text-secondary'
                                  }`}
                                  title="Mark as Correct Answer"
                                >
                                  {opt.id}
                                </button>
                                <input
                                  type="text"
                                  placeholder={`Label for option ${opt.id}...`}
                                  value={opt.text}
                                  onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                                  className="flex-grow px-3 py-2 rounded-lg bg-white/5 dark:bg-white/5 border border-border text-text-primary text-xs focus:outline-none focus:border-brand-primary/50 transition-all font-medium"
                                  required={q.type === 'multiple_choice'}
                                />
                              </div>
                              
                              {/* Option Image input */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/30">
                                <input
                                  type="url"
                                  placeholder="Option Image URL (Optional)..."
                                  value={opt.image_url || ''}
                                  onChange={(e) => {
                                    const updated = [...questions]
                                    const updatedOptions = [...updated[qIdx].options]
                                    updatedOptions[oIdx] = { ...updatedOptions[oIdx], image_url: e.target.value }
                                    updated[qIdx].options = updatedOptions
                                    setQuestions(updated)
                                  }}
                                  className="flex-grow min-w-[120px] px-2.5 py-1.5 rounded-lg bg-white/5 dark:bg-white/5 border border-border text-text-primary text-[10px] focus:outline-none focus:border-brand-primary/50 transition-all font-medium"
                                />
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <label className="cursor-pointer px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-border text-[10px] font-bold text-text-primary flex items-center gap-1 transition-all">
                                    <Upload className="w-3 h-3 text-brand-accent" />
                                    <span>Upload</span>
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) {
                                          handleOptionImageUpload(qIdx, oIdx, file)
                                        }
                                      }}
                                    />
                                  </label>
                                  {opt.image_url && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...questions]
                                        const updatedOptions = [...updated[qIdx].options]
                                        delete updatedOptions[oIdx].image_url
                                        updated[qIdx].options = updatedOptions
                                        setQuestions(updated)
                                      }}
                                      className="px-2 py-1 rounded bg-brand-error/10 hover:bg-brand-error/20 border border-brand-error/30 text-[10px] font-bold text-brand-error cursor-pointer transition-all"
                                      title="Remove option image"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Correct text input for Open Ended */
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">
                          Expected Answer (Case-Insensitive Exact Match)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Hydrogen"
                          value={q.correct_option_id || ''}
                          onChange={(e) => updateQuestionData(qIdx, 'correct_option_id', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all text-sm font-semibold"
                          required={q.type === 'open_ended'}
                        />
                      </div>
                    )}

                    {/* Question Time Limit */}
                    <div className="flex items-center gap-2 pt-2">
                      <Clock className="w-4 h-4 text-text-secondary" />
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        Time Limit:
                      </span>
                      <select
                        value={q.time_limit}
                        onChange={(e) => updateQuestionData(qIdx, 'time_limit', parseInt(e.target.value))}
                        className="px-2 py-1 bg-white/5 dark:bg-white/5 border border-border text-text-primary text-xs rounded-md focus:outline-none font-bold"
                      >
                        <option className="bg-bg text-text-primary" value={10}>10s</option>
                        <option className="bg-bg text-text-primary" value={20}>20s</option>
                        <option className="bg-bg text-text-primary" value={30}>30s</option>
                        <option className="bg-bg text-text-primary" value={45}>45s</option>
                        <option className="bg-bg text-text-primary" value={60}>60s</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-white/5 border border-border hover:bg-white/10 transition-all cursor-pointer text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.03] transition-all text-white disabled:opacity-50 disabled:scale-100 cursor-pointer"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Saving...
                    </>
                  ) : (
                    editingQuizId ? 'Save Changes' : 'Save Quiz Template'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Dashboard Welcome Intro */
            <div className="p-8 rounded-3xl glass-panel text-center space-y-6">
              <Award className="w-16 h-16 text-brand-accent mx-auto animate-bounce mb-2" />
              <h2 className="text-3xl font-black text-gradient">Create Quiz Templates</h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Define reusable question sets once, host live session lobbies with new room codes anytime, and present project scoreboards instantly.
              </p>
              <button
                onClick={() => setShowCreator(true)}
                className="px-6 py-3.5 font-bold rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.03] active:scale-[0.98] transition-all text-sm shadow-lg shadow-brand-primary/20 text-white cursor-pointer"
              >
                Create a Quiz Now
              </button>
            </div>
          )}
        </div>

        {/* Host Session Options Modal */}
        {hostModalQuiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md p-6 rounded-3xl glass-panel space-y-6 border border-border shadow-2xl">
              <div className="space-y-1 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary-light">
                  Host Live Room
                </span>
                <h3 className="text-xl font-black text-text-primary truncate">
                  {hostModalQuiz.title}
                </h3>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-text-primary block flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-brand-accent" />
                      Speed-Based Bonus Scoring
                    </span>
                    <span className="text-[10px] text-text-secondary block">
                      Faster correct answers earn up to 1,000 pts (Kahoot style)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSpeedScoringOption(!speedScoringOption)}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                      speedScoringOption ? 'bg-brand-primary' : 'bg-white/20'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        speedScoringOption ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="text-[10px] text-text-secondary/70 italic border-t border-border/40 pt-2">
                  {speedScoringOption 
                    ? '✓ Speed Mode: Correct answers scale between 500 and 1,000 pts based on time elapsed.'
                    : '✓ Standard Mode: All correct answers earn a flat 100 pts.'}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHostModalQuiz(null)}
                  className="w-1/2 py-3 rounded-xl border border-border text-xs font-bold text-text-secondary hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => executeHostQuiz(hostModalQuiz.id, speedScoringOption)}
                  className="w-1/2 py-3 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.02] text-xs font-bold text-white transition-all cursor-pointer shadow-lg shadow-brand-primary/20"
                >
                  Start Session
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
