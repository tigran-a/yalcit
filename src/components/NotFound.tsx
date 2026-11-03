import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Home, Compass } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export const NotFound: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 bg-bg text-text-primary transition-colors duration-300 text-center">
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl glass-panel animate-glow space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center mx-auto">
          <Compass className="w-8 h-8 text-brand-primary-light animate-spin" style={{ animationDuration: '8s' }} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-accent">
            <Sparkles className="w-3.5 h-3.5" />
            <span>404 — Page Not Found</span>
          </div>
          <h1 className="text-3xl font-black text-gradient">Lost in the Hallway?</h1>
          <p className="text-sm text-text-secondary">
            The classroom or page you are looking for doesn't exist or may have moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => navigate('/')}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-brand-primary to-brand-secondary hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-brand-primary/20"
          >
            <Home className="w-4 h-4" />
            Join a Session
          </button>
          <button
            onClick={() => navigate('/presenter/dashboard')}
            className="flex-1 px-5 py-3.5 rounded-2xl font-bold text-sm text-text-primary bg-white/5 border border-border hover:bg-white/10 transition-all cursor-pointer"
          >
            Presenter Portal
          </button>
        </div>
      </div>
    </div>
  )
}
