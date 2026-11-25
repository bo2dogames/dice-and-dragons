import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { signOutAccount, hydrateAccountData, flushAccountWrites } from '../lib/accountStorage'
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase'

export type AccountUser = { id: string; email: string; displayName: string; role: 'player' | 'master' }
type Credentials = { email: string; password: string }
type Registration = Credentials & { displayName: string; role: 'player' | 'master' }
type AuthContextValue = {
  user: AccountUser | null
  loading: boolean
  syncStatus: 'saved' | 'saving' | 'error'
  syncError: string
  signIn: (input: Credentials) => Promise<void>
  signUp: (input: Registration) => Promise<boolean>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapUser(user: User): AccountUser {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: String(user.user_metadata.display_name ?? user.email?.split('@')[0] ?? 'Игрок'),
    role: user.user_metadata.role === 'master' ? 'master' : 'player',
  }
}

function readableError(message: string) {
  if (message.toLowerCase().includes('invalid login credentials')) return 'Неверная почта или пароль.'
  if (message.toLowerCase().includes('user already registered')) return 'Аккаунт с такой почтой уже существует.'
  if (message.toLowerCase().includes('password should be')) return 'Пароль должен содержать не менее 10 символов.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<AuthContextValue['syncStatus']>('saved')
  const [syncError, setSyncError] = useState('')

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status: AuthContextValue['syncStatus']; message?: string }>).detail
      setSyncStatus(detail.status)
      setSyncError(detail.message ?? '')
    }
    window.addEventListener('dnd-sync-status', handleStatus)
    const client = isSupabaseConfigured ? requireSupabase() : null
    const { data: authListener } = client?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        void signOutAccount()
        setUser(null)
      }
    }) ?? { data: { subscription: null } }

    void (async () => {
      try {
        if (client) {
          const { data, error } = await client.auth.getSession()
          if (error) throw error
          if (data.session?.user) {
            await hydrateAccountData(data.session.user.id)
            setUser(mapUser(data.session.user))
          }
        }
      } catch (error) {
        console.error('Unable to load account', error)
      } finally { setLoading(false) }
    })()
    return () => {
      window.removeEventListener('dnd-sync-status', handleStatus)
      authListener.subscription?.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (input: Credentials) => {
    const { data, error } = await requireSupabase().auth.signInWithPassword(input)
    if (error) throw new Error(readableError(error.message))
    await hydrateAccountData(data.user.id)
    setUser(mapUser(data.user))
  }, [])

  const signUp = useCallback(async (input: Registration) => {
    const { data, error } = await requireSupabase().auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: input.displayName.trim(), role: input.role },
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    })
    if (error) throw new Error(readableError(error.message))
    if (!data.session || !data.user) return false
    await hydrateAccountData(data.user.id)
    setUser(mapUser(data.user))
    return true
  }, [])

  const signOut = useCallback(async () => {
    await flushAccountWrites()
    const { error } = await requireSupabase().auth.signOut()
    if (error) throw new Error(readableError(error.message))
    await signOutAccount()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, syncStatus, syncError, signIn, signUp, signOut }), [user, loading, syncStatus, syncError, signIn, signUp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

