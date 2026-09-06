'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/analytics'

export interface TourStep {
  target: string
  title: string
  description: string
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const REPLAY_EVENT = 'greyin:replay-tour'

/**
 * UI/UX elevation plan, Phase 5 -- guided tour. Self-contained (own auth
 * check, own localStorage flag), same convention as
 * NotificationBell/SectionBadge/CommandPalette, so WorkspaceShell only
 * has to hand it a persona-appropriate `steps` array (it already knows
 * the persona -- variant/role/builder/isAdmin/hasCompany -- since that's
 * what drives which nav items even render) and a `storageKey` unique to
 * this app.
 *
 * Spotlight is 4 plain dimming panels around the target's rect plus a
 * highlight ring, not an SVG mask -- simpler to reason about and
 * position-correct with plain getBoundingClientRect() math, and this
 * codebase already avoids new dependencies for small self-contained UI
 * (NotificationBell's own toast comment).
 *
 * A step whose `data-tour` target isn't currently in the DOM (an
 * admin-only or role-gated nav item the viewer doesn't have) is skipped
 * automatically rather than getting the tour stuck -- defensive
 * filtering on top of WorkspaceShell already picking a persona-specific
 * step list, not a replacement for it.
 */
export function GuidedTour({ steps, storageKey }: { steps: TourStep[]; storageKey: string }) {
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const flagKeyRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      setUserId(user.id)
      const flagKey = `greyin:tour-seen:${storageKey}:${user.id}`
      flagKeyRef.current = flagKey
      try {
        if (!localStorage.getItem(flagKey)) {
          // Short delay so the rail/header have actually painted before
          // the first data-tour lookup runs.
          setTimeout(() => {
            if (!cancelled) {
              setStepIndex(0)
              setActive(true)
              logEvent(supabase, user.id, 'tour_started', { trigger: 'auto', storageKey })
            }
          }, 600)
        }
      } catch {
        // localStorage unavailable (private mode, blocked storage) --
        // the tour just won't auto-start, same fallback NotificationBell
        // and friends already accept for their own storage reads.
      }
    })
    return () => {
      cancelled = true
    }
  }, [supabase, storageKey])

  useEffect(() => {
    const onReplay = () => {
      setStepIndex(0)
      setActive(true)
      if (userId) logEvent(supabase, userId, 'tour_started', { trigger: 'replay', storageKey })
    }
    window.addEventListener(REPLAY_EVENT, onReplay)
    return () => window.removeEventListener(REPLAY_EVENT, onReplay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const finish = (reason: 'completed' | 'skipped') => {
    setActive(false)
    if (userId) logEvent(supabase, userId, reason === 'completed' ? 'tour_completed' : 'tour_skipped', { storageKey, stepIndex })
    try {
      if (flagKeyRef.current) localStorage.setItem(flagKeyRef.current, '1')
    } catch {
      // Same accepted fallback as above -- worst case the tour re-offers
      // itself next visit instead of silently crashing.
    }
  }

  useEffect(() => {
    if (!active) {
      setRect(null)
      return
    }

    let attempts = 0
    let raf = 0

    const measure = () => {
      const step = steps[stepIndex]
      if (!step) {
        finish('completed')
        return
      }
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
      if (!el) {
        // Not on this persona's screen -- try again briefly (layout may
        // still be settling), then give up and skip to the next step.
        attempts += 1
        if (attempts < 3) {
          raf = window.setTimeout(measure, 100)
        } else if (stepIndex < steps.length - 1) {
          setStepIndex((i) => i + 1)
        } else {
          // Ran off the end of the list via auto-skips, not a deliberate
          // Skip click -- counts as reaching the tour's natural end.
          finish('completed')
        }
        return
      }
      el.scrollIntoView({ block: 'nearest' })
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.clearTimeout(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex])

  if (!active || !rect) return null

  const step = steps[stepIndex]
  const pad = 6
  const top = rect.top - pad
  const left = rect.left - pad
  const width = rect.width + pad * 2
  const height = rect.height + pad * 2
  const vw = window.innerWidth
  const vh = window.innerHeight

  const showBelow = vh - (top + height) > 180
  const tooltipTop = showBelow ? top + height + 12 : Math.max(12, top - 12)
  const tooltipLeft = Math.min(Math.max(left, 12), vw - 340)

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Four dimming panels around the target rect -- leaves a real
          "hole" without needing an SVG mask. */}
      <div className="fixed bg-black/60" style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
      <div className="fixed bg-black/60" style={{ top: top + height, left: 0, right: 0, bottom: 0 }} />
      <div className="fixed bg-black/60" style={{ top, left: 0, width: Math.max(0, left), height }} />
      <div className="fixed bg-black/60" style={{ top, left: left + width, right: 0, height }} />
      <div
        className="fixed rounded-lg ring-2 ring-white pointer-events-none"
        style={{ top, left, width, height }}
      />

      <div
        className="fixed w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 dark:bg-gray-900 dark:border-gray-800"
        style={showBelow ? { top: tooltipTop, left: tooltipLeft } : { bottom: vh - tooltipTop, left: tooltipLeft }}
        data-testid="guided-tour-tooltip"
      >
        <p className="text-xs font-medium text-gray-400 mb-1">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-1">{step.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{step.description}</p>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => finish('skipped')}
            data-testid="guided-tour-skip"
            className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i - 1)}
                data-testid="guided-tour-prev"
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 dark:text-gray-300 dark:border-gray-700"
              >
                Prev
              </button>
            )}
            <button
              type="button"
              onClick={() => (stepIndex < steps.length - 1 ? setStepIndex((i) => i + 1) : finish('completed'))}
              data-testid="guided-tour-next"
              className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
            >
              {stepIndex < steps.length - 1 ? 'Next' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function replayTour() {
  window.dispatchEvent(new Event(REPLAY_EVENT))
}
