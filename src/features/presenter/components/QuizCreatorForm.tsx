import React from 'react'
import { Plus, Trash2, Upload, Clock, Loader2, Tag, Folder } from 'lucide-react'

export const QUIZ_CATEGORIES = [
  'General',
  'Languages',
  'Math',
  'Science',
  'History & Geography',
  'Technology & CS',
  'Arts & Literature',
  'Trivia & Fun'
]

export interface QuestionFormItem {
  id?: string
  type: 'multiple_choice' | 'open_ended'
  title: string
  image_url?: string
  options: { id: string; text: string; image_url?: string }[]
  time_limit: number
  correct_option_id?: string
}

interface QuizCreatorFormProps {
  editingQuizId: string | null
  quizTitle: string
  setQuizTitle: (title: string) => void
  quizCategory: string
  setQuizCategory: (cat: string) => void
  quizFolder: string
  setQuizFolder: (folder: string) => void
  quizTagsInput: string
  setQuizTagsInput: (tags: string) => void
  quizIsPublic: boolean
  setQuizIsPublic: (isPublic: boolean) => void
  questions: QuestionFormItem[]
  setQuestions: React.Dispatch<React.SetStateAction<QuestionFormItem[]>>
  creating: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  onQuestionImageUpload: (qIdx: number, file: File) => void
  onOptionImageUpload: (qIdx: number, oIdx: number, file: File) => void
}

export const QuizCreatorForm: React.FC<QuizCreatorFormProps> = ({
  editingQuizId,
  quizTitle,
  setQuizTitle,
  quizCategory,
  setQuizCategory,
  quizFolder,
  setQuizFolder,
  quizTagsInput,
  setQuizTagsInput,
  quizIsPublic,
  setQuizIsPublic,
  questions,
  setQuestions,
  creating,
  onSubmit,
  onCancel,
  onQuestionImageUpload,
  onOptionImageUpload,
}) => {
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
          { id: 'D', text: '' },
        ],
        time_limit: 30,
        correct_option_id: 'A',
      },
    ])
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, idx) => idx !== index))
  }

  const updateQuestionData = (index: number, key: keyof QuestionFormItem, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [key]: value }
    setQuestions(updated)
  }

  const updateOptionText = (qIdx: number, oIdx: number, text: string) => {
    const updated = [...questions]
    const updatedOptions = [...updated[qIdx].options]
    updatedOptions[oIdx] = { ...updatedOptions[oIdx], text }
    updated[qIdx].options = updatedOptions
    setQuestions(updated)
  }

  return (
    <form onSubmit={onSubmit} className="p-8 rounded-3xl glass-panel animate-glow space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-lg font-black text-text-primary">
          {editingQuizId ? 'Edit Quiz Template' : 'Create New Quiz Template'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
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

      {/* Category, Folder & Tags for Search & Organization */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">
            Category
          </label>
          <select
            value={quizCategory}
            onChange={(e) => setQuizCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border text-text-primary text-xs focus:outline-none focus:border-brand-primary/50 transition-all font-bold"
          >
            {QUIZ_CATEGORIES.map((cat) => (
              <option key={cat} className="bg-bg text-text-primary" value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1">
            <Folder className="w-3 h-3 text-brand-accent" />
            <span>Personal Folder (Optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Grade 10 / Fall Semester"
            value={quizFolder}
            onChange={(e) => setQuizFolder(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all text-xs font-semibold"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1">
            <Tag className="w-3 h-3 text-brand-primary-light" />
            <span>Search Tags (Comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. french, beginner, verbs"
            value={quizTagsInput}
            onChange={(e) => setQuizTagsInput(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all text-xs font-semibold"
          />
        </div>
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
                        onQuestionImageUpload(qIdx, file)
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
                                  onOptionImageUpload(qIdx, oIdx, file)
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
          onClick={onCancel}
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
          ) : editingQuizId ? (
            'Save Changes'
          ) : (
            'Save Quiz Template'
          )}
        </button>
      </div>
    </form>
  )
}
