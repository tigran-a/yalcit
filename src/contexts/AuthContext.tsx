import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

interface Profile {
  id: string
  display_name: string
  role: 'presenter' | 'student'
  created_at: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  signInAnonymously: (nickname: string) => Promise<{ user: User; profile: Profile } | null>
  signUpPresenter: (email: string, password: string, name: string) => Promise<void>
  signInPresenter: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateNickname: (nickname: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile from public.profiles
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error.message)
        return null
      }
      return data as Profile
    } catch (err) {
      console.error('Profile fetch failed:', err)
      return null
    }
  }

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const prof = await fetchProfile(currentUser.id)
        setProfile(prof)
      }
      setLoading(false)
    })

    // 2. Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession)
      const currentUser = currentSession?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        const prof = await fetchProfile(currentUser.id)
        setProfile(prof)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Student: Sign in anonymously, then update profile display_name
  const signInAnonymously = async (nickname: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error

      if (!data.user) throw new Error('No user returned from anonymous sign in')

      // Wait a moment for trigger to run and create profile, then update it
      // Let's attempt to update display_name
      let currentProfile: Profile | null = null
      let retries = 5

      while (retries > 0) {
        const { data: updatedProfile, error: profileError } = await supabase
          .from('profiles')
          .update({ display_name: nickname })
          .eq('id', data.user.id)
          .select()
          .single()

        if (!profileError && updatedProfile) {
          currentProfile = updatedProfile as Profile
          break
        }

        // Wait 250ms before retrying (waiting for database trigger)
        await new Promise((resolve) => setTimeout(resolve, 250))
        retries--
      }

      if (!currentProfile) {
        // Fallback: fetch again or construct a temporary one
        currentProfile = await fetchProfile(data.user.id)
        if (!currentProfile) {
          throw new Error('Profile creation timed out after anonymous sign in')
        }
      }

      setUser(data.user)
      setProfile(currentProfile)
      return { user: data.user, profile: currentProfile }
    } catch (err: any) {
      console.error('Anonymous sign-in error:', err.message || err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Presenter: Sign up
  const signUpPresenter = async (email: string, password: string, name: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: name,
            role: 'presenter',
          },
        },
      })
      if (error) throw error
    } catch (err: any) {
      console.error('Presenter signup error:', err.message || err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Presenter: Sign in
  const signInPresenter = async (email: string, password: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    } catch (err: any) {
      console.error('Presenter signin error:', err.message || err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Sign out
  const signOut = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setProfile(null)
      setSession(null)
    } catch (err: any) {
      console.error('Sign out error:', err.message || err)
    } finally {
      setLoading(false)
    }
  }

  // Update profile nickname
  const updateNickname = async (nickname: string) => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: nickname })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      if (data) setProfile(data as Profile)
    } catch (err: any) {
      console.error('Error updating nickname:', err.message || err)
      throw err
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signInAnonymously,
        signUpPresenter,
        signInPresenter,
        signOut,
        updateNickname,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
