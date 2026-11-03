import React, { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { isSoundMuted, setSoundMuted, playJoinPop } from '../lib/soundEffects'

export const SoundToggle: React.FC = () => {
  const [muted, setMuted] = useState<boolean>(() => isSoundMuted())

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ muted: boolean }>
      if (customEvent.detail !== undefined) {
        setMuted(customEvent.detail.muted)
      }
    }
    window.addEventListener('yalcit-sound-change', handler)
    return () => window.removeEventListener('yalcit-sound-change', handler)
  }, [])

  const toggleSound = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    setSoundMuted(nextMuted)
    if (!nextMuted) {
      playJoinPop()
    }
  }

  return (
    <button
      onClick={toggleSound}
      className="p-2.5 rounded-xl bg-white/5 border border-border hover:border-brand-primary/30 text-text-secondary hover:text-text-primary transition-all duration-300 shadow-md flex items-center justify-center cursor-pointer active:scale-95"
      aria-label={muted ? 'Unmute classroom sound effects' : 'Mute classroom sound effects'}
      title={muted ? 'Sound Effects Muted (Click to Unmute)' : 'Sound Effects On (Click to Mute)'}
    >
      {muted ? (
        <VolumeX className="w-5 h-5 text-text-secondary/60" />
      ) : (
        <Volume2 className="w-5 h-5 text-brand-primary-light" />
      )}
    </button>
  )
}
