import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // 1. Check local storage
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }
    // 2. Check system preferences
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
    return 'dark' // default to dark
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.remove('light')
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-brand-primary/30 text-dark-text-secondary hover:text-white transition-all duration-300 shadow-md flex items-center justify-center cursor-pointer active:scale-95"
      aria-label="Toggle light/dark theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-brand-accent animate-pulse-slow" />
      ) : (
        <Moon className="w-5 h-5 text-brand-primary" />
      )}
    </button>
  )
}
