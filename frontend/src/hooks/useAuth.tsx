import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../services/api'
import type { AdminUser } from '../types/admin'

interface AuthContextValue {
  user: AdminUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const result = await api.login(email, password)
    setUser(result.user)
  }

  async function logout() {
    try { await api.logout() } finally { setUser(null) }
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
