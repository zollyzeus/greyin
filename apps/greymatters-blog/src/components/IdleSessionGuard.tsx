'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'

// Idle-timeout session guard (2026-09-03) -- see apps/deepedge/src/components/
// IdleSessionGuard.tsx's own comment for the full rationale (no inactivity
// handling existed anywhere before this: GOTRUE_JWT_EXP is 1hr, but every
// app's middleware.ts silently refreshes an expired access token on every
// request via the long-lived refresh token, so a session never actually
// expired from being idle). Same numbers, same multi-tab design, same
// deliberately-not-dismissed-by-passive-activity warning, duplicated here
// rather than shared per this platform's established per-app-component
// convention.
const ACTIVITY_KEY = 'greyin:lastActivityAt'
const POLL_INTERVAL_MS = 1000
const WARNING_AFTER_MS = 20 * 60 * 1000
const LOGOUT_AFTER_MS = 22 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const

function readLastActivity(): number {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : Date.now()
  } catch {
    return Date.now()
  }
}

function touchActivity() {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  } catch {
    // localStorage unavailable (private mode, etc.) -- idle detection
    // just won't work for this tab; not worth failing the page over.
  }
}

export function IdleSessionGuard() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<'active' | 'warning' | 'expired'>('active')
  const [remainingMs, setRemainingMs] = useState(LOGOUT_AFTER_MS - WARNING_AFTER_MS)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    let active = true
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (active) setIsLoggedIn(!!user)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    touchActivity()
    const handler = () => {
      if (phaseRef.current === 'warning') return
      touchActivity()
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }))
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler))
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) return
    const id = setInterval(() => {
      const elapsed = Date.now() - readLastActivity()
      if (elapsed >= LOGOUT_AFTER_MS) {
        setPhase('expired')
      } else if (elapsed >= WARNING_AFTER_MS) {
        setPhase('warning')
        setRemainingMs(Math.max(0, LOGOUT_AFTER_MS - elapsed))
      } else {
        setPhase('active')
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isLoggedIn])

  const hasSignedOutRef = useRef(false)
  useEffect(() => {
    if (phase !== 'expired' || hasSignedOutRef.current) return
    hasSignedOutRef.current = true
    fetch('/auth/logout', { method: 'POST' }).finally(() => {
      window.location.href = '/login?message=' + encodeURIComponent('You were signed out after a period of inactivity.')
    })
  }, [phase])

  const staySignedIn = async () => {
    touchActivity()
    setPhase('active')
    await createClient().auth.getUser()
  }

  const signOutNow = () => setPhase('expired')

  if (phase !== 'warning') return null

  const minutes = Math.floor(remainingMs / 60000)
  const seconds = Math.floor((remainingMs % 60000) / 1000)

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-session-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h2 id="idle-session-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Still there?</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          You've been inactive for a while. For your security, you'll be signed out in{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>{' '}
          unless you stay signed in.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={staySignedIn}
            className="flex-1 bg-sky-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-sky-700 transition"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={signOutNow}
            className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  )
}
