import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getStoredSession, storeSession } from '../api'
import { AuthContext } from './context'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(getStoredSession)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let active = true
    const initAuth = async () => {
      const stored = getStoredSession()
      if (stored?.token) {
        try {
          const freshUser = await api.getMe()
          if (!active) return
          const updated = { token: stored.token, user: freshUser }
          storeSession(updated)
          setSession(updated)
        } catch {
          if (!active) return
          storeSession(null)
          setSession(null)
        }
      } else {
        if (!active) return
        setSession(null)
      }
      if (active) setInitializing(false)
    }

    initAuth()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleSessionChange = () => {
      setSession(getStoredSession())
    }
    window.addEventListener('cj:session-change', handleSessionChange)
    return () => window.removeEventListener('cj:session-change', handleSessionChange)
  }, [])

  const login = useCallback(async (payload) => {
    const s = await api.login(payload)
    storeSession(s)
    setSession(s)
    return s.user
  }, [])

  const logout = useCallback(async () => {
    if (!window.dispatchEvent(new Event('cj:before-logout', { cancelable: true }))) return false
    try {
      await api.logout()
    } finally {
      storeSession(null)
      setSession(null)
    }
    return true
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      isAdmin: session?.user?.role === 'admin',
      isLecturer: session?.user?.role === 'lecturer',
      isStudent: session?.user?.role === 'student',
      initializing,
      login,
      logout,
    }),
    [session, initializing, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
