// Synthesized classroom sound effects using the browser's native Web Audio API.
// Zero external audio files required.

const MUTE_STORAGE_KEY = 'yalcit_sound_muted'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(MUTE_STORAGE_KEY) === 'true'
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false')
  window.dispatchEvent(new CustomEvent('yalcit-sound-change', { detail: { muted } }))
}

export function playTick(urgent = false): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = urgent ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(urgent ? 880 : 587.33, now)
    osc.frequency.exponentialRampToValueAtTime(urgent ? 440 : 293.66, now + 0.08)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.09)
  } catch {
    // Ignore audio context errors if user hasn't interacted yet
  }
}

export function playJoinPop(): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.09)

    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.11)
  } catch {
    // Ignore audio context errors
  }
}

export function playRevealChime(): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.07
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.26)
    })
  } catch {
    // Ignore audio context errors
  }
}

export function playVictoryFanfare(): void {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.1
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now)

      const duration = idx === notes.length - 1 ? 0.45 : 0.2
      gain.gain.setValueAtTime(0.14, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + duration + 0.02)
    })
  } catch {
    // Ignore audio context errors
  }
}
