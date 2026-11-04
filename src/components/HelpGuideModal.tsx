import React, { useState } from 'react'
import {
  HelpCircle, X, BookOpen, FileJson, Presentation, Smartphone,
  Keyboard, Copy, Check, Download, Sparkles, Tag, Folder
} from 'lucide-react'

const SAMPLE_IMPORT_JSON = `[
  {
    "title": "European Capitals & Geography",
    "category": "History & Geography",
    "folder": "Grade 9 - Unit 2",
    "tags": ["geography", "europe", "capitals"],
    "is_public": false,
    "questions": [
      {
        "type": "multiple_choice",
        "title": "What is the capital city of France?",
        "image_url": "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80",
        "time_limit": 30,
        "correct_option_id": "A",
        "options": [
          { "id": "A", "text": "Paris" },
          { "id": "B", "text": "Lyon" },
          { "id": "C", "text": "Marseille" },
          { "id": "D", "text": "Bordeaux" }
        ]
      },
      {
        "type": "open_ended",
        "title": "Type the name of the river that flows through Paris.",
        "image_url": null,
        "time_limit": 30,
        "correct_option_id": "Seine",
        "options": []
      }
    ]
  }
]`

interface HelpGuideModalProps {
  initialTab?: 'overview' | 'import' | 'live' | 'shortcuts'
  isOpen?: boolean
  onClose?: () => void
  hideTriggerButton?: boolean
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({
  initialTab = 'overview',
  isOpen: controlledOpen,
  onClose,
  hideTriggerButton = false
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'live' | 'shortcuts'>(initialTab)
  const [copiedJson, setCopiedJson] = useState(false)

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen

  const handleClose = () => {
    if (onClose) onClose()
    setInternalOpen(false)
  }

  const handleOpen = (tab: 'overview' | 'import' | 'live' | 'shortcuts' = initialTab) => {
    setActiveTab(tab)
    setInternalOpen(true)
  }

  const handleCopySampleJson = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_IMPORT_JSON)
      setCopiedJson(true)
      setTimeout(() => setCopiedJson(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleDownloadSampleJson = () => {
    const blob = new Blob([SAMPLE_IMPORT_JSON], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'yalcit_sample_quiz_import.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {!hideTriggerButton && (
        <button
          type="button"
          onClick={() => handleOpen(initialTab)}
          className="p-2.5 rounded-xl bg-white/5 border border-border hover:border-brand-primary/30 hover:bg-white/10 text-text-secondary hover:text-text-primary transition-all duration-300 shadow-md flex items-center justify-center cursor-pointer active:scale-95"
          title="User Guide & Import Format Help"
          aria-label="Open User Guide"
        >
          <HelpCircle className="w-5 h-5 text-brand-primary-light" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-3xl glass-panel border border-border shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white/5">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-brand-accent" />
                <div>
                  <h3 className="text-base font-black text-text-primary">
                    Yalcit Platform User Guide
                  </h3>
                  <span className="text-[10px] text-text-secondary font-semibold">
                    Quick reference for hosting, searching, and importing quizzes
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-2 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                aria-label="Close User Guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-1.5 px-6 py-3 border-b border-border bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-brand-primary text-white shadow'
                    : 'bg-white/5 text-text-secondary hover:text-text-primary'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Start & Organization</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'import'
                    ? 'bg-brand-primary text-white shadow'
                    : 'bg-white/5 text-text-secondary hover:text-text-primary'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>JSON Import / Export Format</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('live')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'live'
                    ? 'bg-brand-primary text-white shadow'
                    : 'bg-white/5 text-text-secondary hover:text-text-primary'
                }`}
              >
                <Presentation className="w-3.5 h-3.5" />
                <span>Live Classroom & Word Cloud</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('shortcuts')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'shortcuts'
                    ? 'bg-brand-primary text-white shadow'
                    : 'bg-white/5 text-text-secondary hover:text-text-primary'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Shortcuts & Gradebook</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed text-text-secondary">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-2">
                      <div className="flex items-center gap-2 text-text-primary font-extrabold text-sm">
                        <Presentation className="w-4 h-4 text-brand-primary-light" />
                        <span>For Teachers / Presenters</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1.5 text-text-secondary">
                        <li>Create reusable quizzes with Multiple-Choice or Open-Ended questions and images.</li>
                        <li>Organize your library with <strong>Categories</strong>, <strong>Personal Folders</strong>, and <strong>#tags</strong>.</li>
                        <li>Click <strong>Play (▶)</strong> to launch a live room with either <strong>Speed Bonus</strong> (500–1,000 pts) or <strong>Flat Scoring</strong> (100 pts).</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-2">
                      <div className="flex items-center gap-2 text-text-primary font-extrabold text-sm">
                        <Smartphone className="w-4 h-4 text-brand-accent" />
                        <span>For Students (Zero-Scroll Mobile)</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1.5 text-text-secondary">
                        <li>Join instantly by scanning the <strong>QR code</strong> or entering the 6-character <strong>Room Code</strong>—no account required.</li>
                        <li>All 4 answer options + Submit button fit on a single smartphone screen without scrolling.</li>
                        <li>Draft answers are saved automatically if a student switches browser tabs.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-brand-primary/10 border border-brand-primary/25 space-y-2">
                    <h4 className="font-extrabold text-text-primary flex items-center gap-2">
                      <Folder className="w-4 h-4 text-brand-accent" />
                      <span>Searching & Organizing Thousands of Quizzes</span>
                    </h4>
                    <p>
                      Use the search bar in <strong>My Quizzes</strong> or <strong>Public Shared</strong> to filter by title, author, category, folder, or <code>#tag</code>. Click any <code>#tag</code> pill below the search bar for instant one-click filtering.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'import' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-2">
                    <h4 className="font-extrabold text-text-primary text-sm flex items-center gap-2">
                      <Tag className="w-4 h-4 text-brand-primary-light" />
                      <span>Tags, Categories & Folders on Import</span>
                    </h4>
                    <p>
                      When importing a <code>.json</code> file in <strong>My Quizzes → Import</strong>, you can include <code>category</code>, <code>folder</code>, and <code>tags</code> directly inside each quiz object in the JSON file, <strong>AND/OR</strong> assign a folder and extra tags right in the Import dialog before uploading!
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold text-text-primary uppercase tracking-wider text-[11px]">
                        Example JSON Import Format (Array of Quizzes)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopySampleJson}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-border hover:bg-white/10 text-text-primary font-bold text-[11px] transition-all cursor-pointer"
                        >
                          {copiedJson ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-brand-success" />
                              <span className="text-brand-success">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-brand-primary-light" />
                              <span>Copy Template</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadSampleJson}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary/15 border border-brand-primary/30 hover:bg-brand-primary/25 text-brand-primary-light font-bold text-[11px] transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Sample .json</span>
                        </button>
                      </div>
                    </div>

                    <pre className="p-4 rounded-2xl bg-slate-950 text-slate-200 border border-border overflow-x-auto font-mono text-[11px] leading-relaxed max-h-[260px]">
                      {SAMPLE_IMPORT_JSON}
                    </pre>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                    <div className="p-3 rounded-xl bg-white/5 border border-border">
                      <span className="font-bold text-text-primary block mb-1">Multiple-Choice Questions</span>
                      Set <code>"type": "multiple_choice"</code>, provide 4 options (<code>A</code>, <code>B</code>, <code>C</code>, <code>D</code>), and set <code>"correct_option_id": "A"</code>.
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-border">
                      <span className="font-bold text-text-primary block mb-1">Open-Ended Questions</span>
                      Set <code>"type": "open_ended"</code>, <code>"options": []</code>, and set <code>"correct_option_id"</code> to the expected text answer (case-insensitive).
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'live' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-2">
                    <h4 className="font-extrabold text-text-primary text-sm">
                      1. Classroom Projector Option Cards & Anti-Bandwagon Mode
                    </h4>
                    <p>
                      During a live question, the Presenter screen displays the question prompt and all 4 option cards (<code>A</code>, <code>B</code>, <code>C</code>, <code>D</code>) clearly so students can read from the projector. By default, live vote counts are hidden (<strong>Votes Hidden Until Reveal</strong>) while the timer runs so students cannot copy the tallest bar.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-2">
                    <h4 className="font-extrabold text-text-primary text-sm">
                      2. Open-Ended Dynamic Word Cloud
                    </h4>
                    <p>
                      For Open-Ended questions, identical answers (case-insensitive) automatically combine into a <strong>Word Cloud</strong> where popular responses grow larger (<code>×2</code>, <code>×5</code>). While the timer is active and votes are hidden, bubbles appear blurred (<code>••••• ×3</code>) so the class can see consensus forming without spoiling the word—and unblur as soon as you reveal!
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-2">
                    <h4 className="font-extrabold text-text-primary text-sm">
                      3. Pacing Controls (Instant Jump & Early Interrupt)
                    </h4>
                    <p>
                      As soon as all connected students have submitted an answer (<code>X / X Answered</code>), a green <strong>Jump to Next Question →</strong> button appears. You can also click <strong>Interrupt & Finish Question Now</strong> at any time to end the timer early.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'shortcuts' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-3">
                    <h4 className="font-extrabold text-text-primary text-sm">
                      Presenter Keyboard Shortcuts
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border">
                        <span>Reveal Answer / Next Question</span>
                        <kbd className="px-2 py-1 rounded bg-white/10 text-text-primary font-mono font-bold text-[10px]">
                          Space / →
                        </kbd>
                      </div>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-border">
                        <span>Toggle Classroom Fullscreen</span>
                        <kbd className="px-2 py-1 rounded bg-white/10 text-text-primary font-mono font-bold text-[10px]">
                          F
                        </kbd>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-border space-y-2">
                    <h4 className="font-extrabold text-text-primary text-sm">
                      Session History & CSV Gradebook Export
                    </h4>
                    <p>
                      Click the <strong>Bar Chart (📊)</strong> icon on any quiz card in your dashboard—or click <strong>Export Results (CSV)</strong> on the final leaderboard—to download a spreadsheet with student ranks, scores, correct answer counts, and accuracy percentages.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-white/5 text-[11px] text-text-secondary">
              <span>Full documentation is also saved in <code>USER_GUIDE.md</code> in the repository.</span>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold text-xs cursor-pointer hover:scale-[1.02] transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
