'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  normalizedRole: string
  permissions: string[]
  mustChangePin: boolean
  maxDiscount: number
  photoDataUrl?: string | null
  defaultStartPage?: string | null
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (name: string, pin: string) => Promise<{ ok: boolean; error?: string; mustChangePin?: boolean }>
  logout: () => Promise<void>
  changePin: (currentPin: string, newPin: string) => Promise<{ ok: boolean; error?: string }>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const TOKEN_KEY = 'care_erp_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMe = useCallback(async (tok: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${tok}` },
      })
      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
        return false
      }
      const data = await res.json()
      if (data.authenticated) {
        setUser(data.user)
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
    if (t) {
      setToken(t)
      fetchMe(t).finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [fetchMe])

  const login = useCallback(async (name: string, pin: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        return { ok: false, error: data.error || 'Login failed' }
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      return { ok: true, mustChangePin: data.user.mustChangePin }
    } catch (e) {
      return { ok: false, error: 'Network error' }
    }
  }, [])

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch('/api/auth/me', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {}
    }
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [token])

  const changePin = useCallback(async (currentPin: string, newPin: string) => {
    if (!token) return { ok: false, error: 'Not logged in' }
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPin, newPin }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error || 'Failed' }
      setUser((u) => (u ? { ...u, mustChangePin: false } : u))
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error' }
    }
  }, [token])

  const refresh = useCallback(async () => {
    if (token) await fetchMe(token)
  }, [token, fetchMe])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, changePin, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// API helper with auto-auth header
export function useApi() {
  const { token } = useAuth()
  return {
    get: async (path: string) => {
      const res = await fetch(path, { headers: { Authorization: `Bearer ${token || ''}` } })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed')
      return res.json()
    },
    post: async (path: string, body?: unknown) => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    },
    put: async (path: string, body?: unknown) => {
      const res = await fetch(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    },
    patch: async (path: string, body?: unknown) => {
      const res = await fetch(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    },
    del: async (path: string) => {
      const res = await fetch(path, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Delete failed')
      return res.json()
    },
  }
}
