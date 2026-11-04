import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Play, LogOut, Loader2, Trash2, Award, FileText,
  CheckCircle2, Edit2, Copy, Eye, EyeOff, Upload, Download,
  ExternalLink, RefreshCw, BarChart3, Home, Search, Folder, Tag, X
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { ThemeToggle } from '../../components/ThemeToggle'
import { SoundToggle } from '../../components/SoundToggle'
import { HostSessionModal } from './components/HostSessionModal'
import { SessionHistoryModal } from './components/SessionHistoryModal'
import { QuizCreatorForm, QUIZ_CATEGORIES, type QuestionFormItem } from './components/QuizCreatorForm'

interface Quiz {
  id: string
  title: string
  created_at: string
  is_public: boolean
  is_demo?: boolean
  category?: string
  folder?: string
  tags?: string[]
  forked_from_id?: string | null
  presenter_id?: string
  profiles?: { display_name: string } | null
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
  const [demoEnabled, setDemoEnabled] = useState(true)

  // Quiz Creator/Editor Form States
  const [showCreator, setShowCreator] = useState(false)
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null)
  const [quizTitle, setQuizTitle] = useState('')
  const [quizCategory, setQuizCategory] = useState('General')
  const [quizFolder, setQuizFolder] = useState('')
  const [quizTagsInput, setQuizTagsInput] = useState('')
  const [quizIsPublic, setQuizIsPublic] = useState(false)
  const [questions, setQuestions] = useState<QuestionFormItem[]>([
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

  // Filter/tab, Search, Category, Folder, Tag & Modal states
  const [quizTab, setQuizTab] = useState<'mine' | 'public'>('mine')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedFolder, setSelectedFolder] = useState<string>('All')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState<number>(20)
  const [selectedQuizIds, setSelectedQuizIds] = useState<Record<string, boolean>>({})
  const [hostModalQuiz, setHostModalQuiz] = useState<Quiz | null>(null)
  const [speedScoringOption, setSpeedScoringOption] = useState<boolean>(true)
  const [historyModalQuiz, setHistoryModalQuiz] = useState<Quiz | null>(null)

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

  const handleToggleDemoQuizzes = async () => {
    try {
      const nextState = !demoEnabled
      if (nextState) {
        await supabase.rpc('enable_demo_quizzes')
      } else {
        await supabase.rpc('disable_demo_quizzes')
      }
      setDemoEnabled(nextState)
      fetchData()
    } catch (err: any) {
      console.error('Error toggling demo quizzes:', err)
      setError('Could not toggle demo quizzes.')
    }
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

    const parsedTags = quizTagsInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)

    try {
      let targetQuizId = editingQuizId

      if (editingQuizId) {
        const { error: quizErr } = await supabase
          .from('quizzes')
          .update({
            title: title,
            category: quizCategory || 'General',
            folder: quizFolder.trim(),
            tags: parsedTags,
            is_public: quizIsPublic
          })
          .eq('id', editingQuizId)

        if (quizErr) throw quizErr

        const { error: clearErr } = await supabase
          .from('questions')
          .delete()
          .eq('quiz_id', editingQuizId)

        if (clearErr) throw clearErr
      } else {
        const { data: quizData, error: quizErr } = await supabase
          .from('quizzes')
          .insert({
            presenter_id: user.id,
            title: title,
            category: quizCategory || 'General',
            folder: quizFolder.trim(),
            tags: parsedTags,
            is_public: quizIsPublic
          })
          .select()
          .single()

        if (quizErr) throw quizErr
        targetQuizId = quizData.id
      }

      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx]

        const { data: insertedQuestion, error: qErr } = await supabase
          .from('questions')
          .insert({
            quiz_id: targetQuizId,
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
    setQuizCategory('General')
    setQuizFolder('')
    setQuizTagsInput('')
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
      setQuestions(prev => {
        const updated = [...prev]
        updated[qIdx] = { ...updated[qIdx], image_url: url }
        return updated
      })
    })
  }

  const handleOptionImageUpload = async (qIdx: number, oIdx: number, file: File) => {
    await handleUploadImage(file, (url) => {
      setQuestions(prev => {
        const updated = [...prev]
        const updatedOptions = [...updated[qIdx].options]
        updatedOptions[oIdx] = { ...updatedOptions[oIdx], image_url: url }
        updated[qIdx].options = updatedOptions
        return updated
      })
    })
  }

  // Load quiz details for editing
  const handleEditQuiz = async (quiz: Quiz) => {
    try {
      setLoading(true)
      setError(null)
      setEditingQuizId(quiz.id)
      setQuizTitle(quiz.title)
      setQuizCategory(quiz.category || 'General')
      setQuizFolder(quiz.folder || '')
      setQuizTagsInput(Array.isArray(quiz.tags) ? quiz.tags.join(', ') : '')
      setQuizIsPublic(quiz.is_public)

      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('*, question_answers(correct_option_id)')
        .eq('quiz_id', quiz.id)
        .order('sort_order', { ascending: true })

      if (qErr) throw qErr

      const mappedQuestions: QuestionFormItem[] = (questionsData || []).map((q: any) => {
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

  // Clones a quiz into the user's library
  const handleDuplicateQuiz = async (quiz: Quiz) => {
    try {
      setLoading(true)
      setError(null)

      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('*, question_answers(correct_option_id)')
        .eq('quiz_id', quiz.id)
        .order('sort_order', { ascending: true })

      if (qErr) throw qErr

      const { data: newQuiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          presenter_id: user?.id,
          title: `${quiz.title} (Copy)`,
          category: quiz.category || 'General',
          folder: quiz.folder || '',
          tags: Array.isArray(quiz.tags) ? quiz.tags : [],
          is_public: false,
          forked_from_id: quiz.id
        })
        .select()
        .single()

      if (quizErr) throw quizErr

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

      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('image_url, options')
        .eq('quiz_id', id)

      if (qErr) throw qErr

      const imagesToDelete: string[] = []
      if (questionsData) {
        questionsData.forEach((q: any) => {
          if (q.image_url) imagesToDelete.push(q.image_url)
          if (Array.isArray(q.options)) {
            q.options.forEach((opt: any) => {
              if (opt.image_url) imagesToDelete.push(opt.image_url)
            })
          }
        })
      }

      const { error: delErr } = await supabase.from('quizzes').delete().eq('id', id)
      if (delErr) throw delErr

      for (const imgUrl of imagesToDelete) {
        if (!imgUrl.includes('/storage/v1/object/public/yalcit-media/')) continue

        const { data: qUsage } = await supabase
          .from('questions')
          .select('id')
          .eq('image_url', imgUrl)
          .limit(1)

        if (qUsage && qUsage.length > 0) continue

        const { data: optUsage } = await supabase
          .from('questions')
          .select('id')
          .contains('options', [{ image_url: imgUrl }])
          .limit(1)

        if (optUsage && optUsage.length > 0) continue

        const pathParts = imgUrl.split('/yalcit-media/')
        if (pathParts.length > 1) {
          const filePath = pathParts[1]
          await supabase.storage.from('yalcit-media').remove([filePath])
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

  const handleHostQuiz = (quizId: string) => {
    const targetQuiz = [...quizzes, ...publicQuizzes].find(q => q.id === quizId)
    if (targetQuiz) {
      setHostModalQuiz(targetQuiz)
      setSpeedScoringOption(true)
    }
  }

  const executeHostQuiz = async (quizId: string, speedScoring: boolean) => {
    if (!user) return
    try {
      setLoading(true)
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()

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
          category: quiz.category || 'General',
          folder: quiz.folder || '',
          tags: quiz.tags || [],
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

            const { data: newQuiz, error: qzErr } = await supabase
              .from('quizzes')
              .insert({
                presenter_id: user.id,
                title: item.title,
                category: item.category || 'General',
                folder: item.folder || '',
                tags: Array.isArray(item.tags) ? item.tags : [],
                is_public: !!item.is_public
              })
              .select()
              .single()

            if (qzErr) throw qzErr

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

  // Compute available folders for "My Quizzes"
  const availableFolders = Array.from(
    new Set(quizzes.map(q => (q.folder || '').trim()).filter(Boolean))
  ).sort()

  // Compute popular tags in the currently active tab
  const activeSourceList = quizTab === 'mine' ? quizzes : publicQuizzes
  const availableTags = Array.from(
    new Set(activeSourceList.flatMap(q => Array.isArray(q.tags) ? q.tags : []))
  ).slice(0, 12)

  // Filter quizzes by search query, category, folder, and tag
  const filterQuizList = (list: Quiz[], isMine: boolean) => {
    const q = searchQuery.trim().toLowerCase()
    return list.filter((quiz) => {
      if (selectedCategory !== 'All' && (quiz.category || 'General') !== selectedCategory) {
        return false
      }
      if (isMine && selectedFolder !== 'All' && (quiz.folder || '').trim() !== selectedFolder) {
        return false
      }
      if (selectedTag && (!Array.isArray(quiz.tags) || !quiz.tags.includes(selectedTag))) {
        return false
      }
      if (q) {
        const matchTitle = quiz.title.toLowerCase().includes(q)
        const matchAuthor = (quiz.profiles?.display_name || '').toLowerCase().includes(q)
        const matchCategory = (quiz.category || '').toLowerCase().includes(q)
        const matchFolder = (quiz.folder || '').toLowerCase().includes(q)
        const matchTag = Array.isArray(quiz.tags) && quiz.tags.some(t => t.toLowerCase().includes(q))
        return matchTitle || matchAuthor || matchCategory || matchFolder || matchTag
      }
      return true
    })
  }

  const filteredMyQuizzes = filterQuizList(quizzes, true)
  const filteredPublicQuizzes = filterQuizList(publicQuizzes, false)
  const activeFilteredList = quizTab === 'mine' ? filteredMyQuizzes : filteredPublicQuizzes
  const paginatedList = activeFilteredList.slice(0, visibleCount)

  return (
    <div className="relative flex flex-col min-h-screen p-6 bg-bg text-text-primary transition-colors duration-300">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 mb-10 pb-4 border-b border-border">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-wider text-gradient">YALCIT</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary-light hidden sm:inline">
              Yet Another Live Classroom Interaction Tool
            </span>
          </div>
          <span className="text-[10px] text-text-secondary uppercase tracking-widest mt-0.5">
            Presenter: {profile?.display_name || 'Administrator'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-xs font-semibold text-text-secondary hover:text-text-primary transition-all cursor-pointer"
            title="Student Join Screen"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Join Screen</span>
          </button>
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-text-primary transition-all cursor-pointer"
            title="Refresh Dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <SoundToggle />
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

            {/* Search, Category, Folder & Tag Filters */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={quizTab === 'mine' ? 'Search by title, folder, or #tag...' : 'Search thousands of quizzes by title, author, or #tag...'}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setVisibleCount(20)
                  }}
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value)
                    setVisibleCount(20)
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border text-[11px] font-bold text-text-primary focus:outline-none focus:border-brand-primary/50"
                >
                  <option className="bg-bg text-text-primary" value="All">All Categories</option>
                  {QUIZ_CATEGORIES.map(cat => (
                    <option key={cat} className="bg-bg text-text-primary" value={cat}>{cat}</option>
                  ))}
                </select>

                {quizTab === 'mine' ? (
                  <select
                    value={selectedFolder}
                    onChange={(e) => {
                      setSelectedFolder(e.target.value)
                      setVisibleCount(20)
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border text-[11px] font-bold text-text-primary focus:outline-none focus:border-brand-primary/50"
                  >
                    <option className="bg-bg text-text-primary" value="All">📁 All Folders</option>
                    {availableFolders.map(folder => (
                      <option key={folder} className="bg-bg text-text-primary" value={folder}>📁 {folder}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={handleToggleDemoQuizzes}
                    className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-text-primary transition-all font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer truncate"
                    title="Enable or disable demo quizzes"
                  >
                    <span>{demoEnabled ? '🇫🇷 Hide Demo' : '🇫🇷 Show Demo'}</span>
                  </button>
                )}
              </div>

              {availableTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <Tag className="w-3 h-3 text-text-secondary flex-shrink-0" />
                  {availableTags.map(tag => {
                    const isActive = selectedTag === tag
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedTag(isActive ? null : tag)
                          setVisibleCount(20)
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-white/5 border-border text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        #{tag}
                      </button>
                    )
                  })}
                </div>
              )}
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
              {quizTab === 'mine' && paginatedList.map((quiz) => (
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
                      <div className="flex items-center flex-wrap gap-1.5 text-[9px] text-text-secondary">
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
                        {quiz.category && (
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-text-primary font-bold">
                            {quiz.category}
                          </span>
                        )}
                        {quiz.folder && (
                          <span className="px-1.5 py-0.5 rounded bg-brand-accent/15 text-brand-accent font-bold flex items-center gap-0.5">
                            <Folder className="w-2.5 h-2.5" />
                            {quiz.folder}
                          </span>
                        )}
                        {quiz.forked_from_id && (
                          <span className="text-brand-accent/70 font-semibold italic">Forked</span>
                        )}
                        {quiz.is_demo && (
                          <span className="px-1.5 py-0.5 rounded bg-brand-primary/20 text-brand-primary text-[8px] font-black uppercase">Demo</span>
                        )}
                      </div>
                      {Array.isArray(quiz.tags) && quiz.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap pt-0.5">
                          {quiz.tags.slice(0, 4).map(t => (
                            <span key={t} className="text-[8px] px-1.5 py-0.2 rounded-full bg-white/5 border border-border text-text-secondary">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
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
                      onClick={() => setHistoryModalQuiz(quiz)}
                      className="p-1.5 rounded hover:bg-brand-accent/15 text-brand-accent transition-all cursor-pointer"
                      title="Session History & CSV Gradebook"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
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
                      title={quiz.is_public ? 'Make Private' : 'Make Public'}
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
              {quizTab === 'public' && paginatedList.map((quiz) => (
                <div
                  key={quiz.id}
                  className="p-3.5 rounded-2xl bg-white/5 dark:bg-white/5 border border-border hover:border-brand-primary/30 flex items-center justify-between transition-all duration-300 text-xs"
                >
                  <div className="space-y-1 truncate pr-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-text-primary truncate">
                        {quiz.title}
                      </h3>
                      {quiz.is_demo && (
                        <span className="px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary-light border border-brand-primary/30 text-[9px] font-extrabold uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                          <span>🇫🇷</span> Demo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5 text-[9px] text-text-secondary">
                      <span>By: {quiz.profiles?.display_name || 'Presenter'}</span>
                      {quiz.category && (
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-text-primary font-bold">
                          {quiz.category}
                        </span>
                      )}
                      {quiz.forked_from_id && <span className="italic text-brand-accent/50">Derived Quiz</span>}
                    </div>
                    {Array.isArray(quiz.tags) && quiz.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {quiz.tags.slice(0, 5).map(t => (
                          <span key={t} className="text-[8px] px-1.5 py-0.2 rounded-full bg-white/5 border border-border text-text-secondary">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
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

              {/* Load More Button for Large Libraries */}
              {activeFilteredList.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => prev + 20)}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-xs font-bold text-brand-primary-light transition-all cursor-pointer"
                >
                  Load More ({activeFilteredList.length - visibleCount} remaining)
                </button>
              )}

              {/* Empty States */}
              {quizTab === 'mine' && filteredMyQuizzes.length === 0 && !loading && (
                <div className="text-center p-8 rounded-2xl border border-dashed border-border text-text-secondary">
                  <FileText className="w-8 h-8 text-border mx-auto mb-2" />
                  <p className="text-xs">
                    {quizzes.length === 0
                      ? 'No quiz templates created yet. Click the + button!'
                      : 'No quizzes match your current search or filter.'}
                  </p>
                </div>
              )}

              {quizTab === 'public' && filteredPublicQuizzes.length === 0 && !loading && (
                <div className="text-center p-8 rounded-2xl border border-dashed border-border text-text-secondary">
                  <ExternalLink className="w-8 h-8 text-border mx-auto mb-2" />
                  <p className="text-xs">
                    {publicQuizzes.length === 0
                      ? 'No public quiz templates shared by others yet.'
                      : 'No public quizzes match your current search or filter.'}
                  </p>
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
            <QuizCreatorForm
              editingQuizId={editingQuizId}
              quizTitle={quizTitle}
              setQuizTitle={setQuizTitle}
              quizCategory={quizCategory}
              setQuizCategory={setQuizCategory}
              quizFolder={quizFolder}
              setQuizFolder={setQuizFolder}
              quizTagsInput={quizTagsInput}
              setQuizTagsInput={setQuizTagsInput}
              quizIsPublic={quizIsPublic}
              setQuizIsPublic={setQuizIsPublic}
              questions={questions}
              setQuestions={setQuestions}
              creating={creating}
              onSubmit={handleCreateQuiz}
              onCancel={resetForm}
              onQuestionImageUpload={handleQuestionImageUpload}
              onOptionImageUpload={handleOptionImageUpload}
            />
          ) : (
            /* Dashboard Welcome Intro */
            <div className="p-8 rounded-3xl glass-panel text-center space-y-6">
              <Award className="w-16 h-16 text-brand-accent mx-auto animate-bounce mb-2" />
              <h2 className="text-3xl font-black text-gradient">Create Quiz Templates</h2>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Define reusable question sets once, host live session lobbies with new room codes anytime, present live scoreboards, and export CSV gradebooks.
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
          <HostSessionModal
            quizTitle={hostModalQuiz.title}
            speedScoringOption={speedScoringOption}
            setSpeedScoringOption={setSpeedScoringOption}
            onCancel={() => setHostModalQuiz(null)}
            onConfirm={() => executeHostQuiz(hostModalQuiz.id, speedScoringOption)}
          />
        )}

        {/* Session History & Gradebook Modal */}
        {historyModalQuiz && (
          <SessionHistoryModal
            quizId={historyModalQuiz.id}
            quizTitle={historyModalQuiz.title}
            onClose={() => setHistoryModalQuiz(null)}
          />
        )}
      </main>
    </div>
  )
}
