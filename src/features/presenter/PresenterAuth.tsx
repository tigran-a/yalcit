import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Mail, Lock, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { ThemeToggle } from '../../components/ThemeToggle'

export const PresenterAuth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { signInPresenter, signUpPresenter } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanedEmail = email.trim()
    const cleanedPassword = password.trim()
    const cleanedName = name.trim()

    if (!cleanedEmail || !cleanedPassword || (isSignUp && !cleanedName)) {
      setError('Please fill in all fields.')
      return
    }

    if (cleanedPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        await signUpPresenter(cleanedEmail, cleanedPassword, cleanedName)
        setError('Verification link sent! Please check your email inbox to activate your account.')
      } else {
        await signInPresenter(cleanedEmail, cleanedPassword)
        navigate('/presenter/dashboard')
      }
    } catch (err: any) {
      console.error('Presenter auth failed:', err)
      setError(err.message || 'Authentication error. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-6 bg-bg text-text-primary selection:bg-brand-primary selection:text-white transition-colors duration-300">
      {/* Floating Theme Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl glass-panel animate-glow">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-8 h-8 text-brand-accent animate-pulse-slow" />
            <span className="text-3xl font-extrabold tracking-wider text-gradient">YALCIT</span>
          </div>
          <span className="text-sm font-semibold uppercase tracking-wider text-brand-primary-light">
            Presenter Dashboard
          </span>
        </div>

        {error && (
          <div className={`flex items-start gap-3 p-4 mb-6 rounded-2xl text-sm ${
            error.includes('sent') 
              ? 'bg-brand-success/10 border border-brand-success/20 text-brand-success' 
              : 'bg-brand-error/10 border border-brand-error/20 text-brand-error'
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-secondary/50">
                  <UserIcon className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Professor Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-secondary/50">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                placeholder="e.g. prof@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-text-secondary/50">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-5 py-4 rounded-2xl bg-white/5 dark:bg-white/5 border border-border focus:border-brand-primary/50 text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all duration-300"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 font-bold rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-light hover:to-brand-secondary transition-all duration-300 shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 cursor-pointer text-white"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isSignUp ? (
              'Create Presenter Account'
            ) : (
              'Sign In as Presenter'
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-border pt-6 text-sm text-text-secondary">
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setIsSignUp(false)
                  setError(null)
                }}
                className="font-bold text-brand-primary-light hover:text-brand-primary transition-colors cursor-pointer"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              New to YALCIT?{' '}
              <button
                onClick={() => {
                  setIsSignUp(true)
                  setError(null)
                }}
                className="font-bold text-brand-primary-light hover:text-brand-primary transition-colors cursor-pointer"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
