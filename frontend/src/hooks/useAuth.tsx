import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, onUnauthorized } from '../services/api'
import type { AdminUser } from '../types/admin'

interface AuthContextValue {
  user: AdminUser | null
  loading: boolean
  sessionExpired: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => onUnauthorized(() => {
    setUser(null)
    setSessionExpired(true)
  }), [])

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const result = await api.login(email, password)
    setUser(result.user)
    setSessionExpired(false)
  }

  async function logout() {
    try { await api.logout() } finally { setUser(null); setSessionExpired(false) }
  }

  return <AuthContext.Provider value={{ user, loading, sessionExpired, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
