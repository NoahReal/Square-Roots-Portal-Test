// Keeps track of who is logged in. Wrap the app in <AuthProvider>,
// then call useAuth() in any component to get { user, demoMode, login, signup, logout, ... }.

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api, SESSION_EXPIRED_EVENT } from './api'

const AuthContext = createContext(null)

// Remembers, across the redirect, that someone was sent to the login page because their session ended.
const EXPIRED_KEY = 'sr-session-expired'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [demoMode, setDemoMode] = useState(false)
  const userRef = useRef(null)
  userRef.current = user

  // On first load: get a CSRF cookie (and whether this is a demo), then ask Django if we're already logged in.
  useEffect(() => {
    api('/auth/csrf/')
      .then((config) => setDemoMode(Boolean(config.demo_mode)))
      .then(() => api('/auth/me/'))
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false))
  }, [])

  // If the server says we're no longer logged in (session timed out, logged out in another tab),
  // forget the user; the page then sends them to the login screen.
  useEffect(() => {
    function onExpired() {
      if (!userRef.current) return
      try {
        sessionStorage.setItem(EXPIRED_KEY, '1')
      } catch {
        // Private browsing can block storage; the login page just won't show the message.
      }
      setUser(null)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  // `code` is the 6-digit code from an authenticator app, for accounts with two-step login.
  async function login(username, password, code) {
    const loggedIn = await api('/auth/login/', { method: 'POST', body: { username, password, code } })
    setUser(loggedIn)
    return loggedIn
  }

  // Sign-up from the website. The server logs the new person in straight away
  // (their account is pending until an admin approves it).
  async function signup(form) {
    const newUser = await api('/signup/', { method: 'POST', body: form })
    setUser(newUser)
    return newUser
  }

  async function logout() {
    await api('/auth/logout/', { method: 'POST' })
    setUser(null)
  }

  // After changing your details on the My Account page.
  function refreshUser(updated) {
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, checking, demoMode, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

// True once, right after someone was logged out because their session ended.
export function takeSessionExpiredFlag() {
  try {
    const expired = sessionStorage.getItem(EXPIRED_KEY) === '1'
    sessionStorage.removeItem(EXPIRED_KEY)
    return expired
  } catch {
    return false
  }
}
