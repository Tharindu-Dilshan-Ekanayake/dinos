/**
 * Thin React hooks over systems/bloxity.js - the same division of labour as
 * useQuality.js wrapping quality.js: no business logic here, just a
 * `useState` seeded from the module's synchronous getter and kept in sync via
 * its subscribe function.
 */
import { useEffect, useState } from 'react'
import {
  getBloxityAuthState,
  getBloxityFriends,
  getBloxitySettings,
  subscribeBloxityAuth,
  subscribeBloxitySettings,
} from './bloxity.js'

export function useBloxityAuth() {
  const [auth, setAuth] = useState(getBloxityAuthState)
  useEffect(() => subscribeBloxityAuth(setAuth), [])
  return auth
}

export function useBloxitySettings() {
  const [settings, setSettings] = useState(getBloxitySettings)
  useEffect(() => subscribeBloxitySettings(setSettings), [])
  return settings
}

/**
 * `getFriends()` is a one-shot Promise, not a subscription, so this only
 * fetches while `open` is true - reopening the list refreshes it, closing it
 * does not keep polling in the background.
 */
export function useBloxityFriends(open) {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    getBloxityFriends()
      .then((list) => {
        if (!cancelled) setFriends(Array.isArray(list) ? list : [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return { friends, loading }
}
