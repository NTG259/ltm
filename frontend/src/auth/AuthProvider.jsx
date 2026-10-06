import { useCallback, useMemo, useState } from 'react'
import { api, getStoredSession, storeSession } from '../api'
import { AuthContext } from './context'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(getStoredSession)

  const login = useCallback(async (payload) => {
    const s = await api.login(payload)
    storeSession(s)
    setSession(s)
    return s.user
  }, [])

  const logout = useCallback(() => {
    storeSession(null)
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ user: session?.user ?? null, isAdmin: session?.user?.role === 'admin', login, logout }),
    [session, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
