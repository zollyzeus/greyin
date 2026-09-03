'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Idle-timeout session guard (2026-09-03) -- there was previously no
// inactivity handling at all: GOTRUE_JWT_EXP is 1 hour, but every app's
// middleware.ts calls getUser() on every request, which silently
// refreshes an expired access token via the long-lived refresh token
// (~400 day cookie Max-Age) with no user-visible interruption ever. A
// session genuinely never expired on its own. This adds a real, visible
// idle policy on top of that: WARNING_AFTER_MS of no activity shows a
// countdown modal; a further LOGOUT_AFTER_MS - WARNING_AFTER_MS with no
// response signs the user out. Numbers are a deliberate product choice,
// not a technical constraint -- 20 min to warn, 2 more to act, roughly
// matching common enterprise-SaaS idle policies (AWS console, Salesforce)
// for a platform handling hiring/candidate data.
//
// Multi-tab: activity in ANY tab keeps every tab's session alive, and a
// timeout in one tab doesn't leave a stale "still logged in"-looking tab
// elsewhere. Done via a single shared localStorage timestamp (not
// BroadcastChannel -- simpler, and "poll a timestamp" degrades gracefully
// if a tab is suspended/backgrounded, where a channel message could be
// missed) that every tab's own 1s poll reads independently. Each tab
// converges on the same phase within one poll tick of the timestamp
// changing, so a user active in tab B dismisses tab A's warning within a
// second, without tab A needing to know tab B exists.
//
// Deliberately NOT dismissed by passive activity (mousemove etc.) *while
// the warning is showing* -- same reasoning AWS/Salesforce use: once the
// countdown is up, only an explicit "Stay signed in" click (or genuine
// activity in a *different* tab, which still updates the shared
// timestamp) counts. Otherwise the warning is close to meaningless -- the
// cursor drifting across the screen while someone's away from their desk
// would silently keep re-arming it.
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

  // Own-tab activity listeners -- suppressed while the warning is up
  // (see banner comment); a fresh mount seeds the clock so a brand-new
  // login doesn't inherit some earlier tab's stale timestamp.
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

  // The single source of truth for phase -- re-derived from the shared
  // timestamp every tick, so any tab (including a change written by
  // another tab) is reflected within one poll interval.
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
    // Proactively revalidate -- if the access token has aged past its
    // own 1hr expiry during the idle window, this refreshes it via the
    // refresh token now rather than leaving that to the next navigation.
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
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h2 id="idle-session-title" className="text-lg font-bold text-gray-900 mb-2">Still there?</h2>
        <p className="text-sm text-gray-600 mb-5">
          You've been inactive for a while. For your security, you'll be signed out in{' '}
          <span className="font-semibold text-gray-900 tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>{' '}
          unless you stay signed in.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={staySignedIn}
            className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={signOutNow}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  )
}
