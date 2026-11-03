import React from 'react'
import { Sparkles } from 'lucide-react'

interface HostSessionModalProps {
  quizTitle: string
  speedScoringOption: boolean
  setSpeedScoringOption: (val: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

export const HostSessionModal: React.FC<HostSessionModalProps> = ({
  quizTitle,
  speedScoringOption,
  setSpeedScoringOption,
  onCancel,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md p-6 rounded-3xl glass-panel space-y-6 border border-border shadow-2xl">
        <div className="space-y-1 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary-light">
            Host Live Room
          </span>
          <h3 className="text-xl font-black text-text-primary truncate">
            {quizTitle}
          </h3>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
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
            onClick={onCancel}
            className="w-1/2 py-3 rounded-xl border border-border text-xs font-bold text-text-secondary hover:bg-white/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-1/2 py-3 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.02] text-xs font-bold text-white transition-all cursor-pointer shadow-lg shadow-brand-primary/20"
          >
            Start Session
          </button>
        </div>
      </div>
    </div>
  )
}
