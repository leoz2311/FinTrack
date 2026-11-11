import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    configured: isSupabaseConfigured,
    signOut: async () => {
      if (supabase) await supabase.auth.signOut()
    }
  }), [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth mora biti unutar AuthProvidera.')
  return context
}
