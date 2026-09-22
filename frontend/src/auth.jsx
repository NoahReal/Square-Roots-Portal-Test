// Keeps track of who is logged in. Wrap the app in <AuthProvider>,
// then call useAuth() in any component to get { user, login, logout }.

import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // On first load: get a CSRF cookie, then ask Django if we're already logged in.
  useEffect(() => {
    api('/auth/csrf/')
      .then(() => api('/auth/me/'))
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  async function login(username, password) {
    const loggedIn = await api('/auth/login/', { method: 'POST', body: { username, password } })
    setUser(loggedIn)
    return loggedIn
  }

  async function logout() {
    await api('/auth/logout/', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
