'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'

/**
 * UI/UX elevation plan, Phase 2 close-out (2026-09-06): "Section badges"
 * -- unread counts on rail nav items whose notification `type` maps to
 * that section, per the plan's own table. Self-contained (own auth
 * check + Realtime subscription + 45s poll fallback), same pattern as
 * NotificationBell rather than lifting shared state into WorkspaceShell
 * -- keeps this additive and low-risk instead of refactoring the
 * already-shipped bell.
 */
export function SectionBadge({ types }: { types: string[] }) {
  const [supabase] = useState(() => createClient())
  const [count, setCount] = useState(0)
  const typesKey = types.join(',')

  useEffect(() => {
    let active = true
    let pollId: ReturnType<typeof setInterval> | undefined
    let onNotificationsRead: (() => void) | undefined
    const typeList = typesKey.split(',')

    const refetch = (uid: string) => {
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('read', false)
        .in('type', typeList)
        .then(({ count }) => {
          if (active) setCount(count || 0)
        })
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return
      refetch(user.id)

      const channel = supabase
        .channel(`section-badge:${user.id}:${typesKey}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as { type: string }
            if (typeList.includes(row.type)) setCount((c) => c + 1)
          }
        )
        .subscribe()

      pollId = setInterval(() => refetch(user.id), 45000)

      // The Realtime subscription above only catches new INSERTs -- a
      // notification transitioning to read (e.g. opening the feedback
      // modal marks the whole feedback_replied type read at once) would
      // otherwise not clear the badge until the 45s poll. Listen for the
      // app-wide signal those actions fire and refetch immediately.
      onNotificationsRead = () => refetch(user.id)
      window.addEventListener('greyin:notifications-read', onNotificationsRead)

      return () => {
        supabase.removeChannel(channel)
      }
    })

    return () => {
      active = false
      if (pollId) clearInterval(pollId)
      if (onNotificationsRead) window.removeEventListener('greyin:notifications-read', onNotificationsRead)
    }
  }, [supabase, typesKey])

  if (count === 0) return null

  return (
    <span
      data-testid="section-badge"
      className="ml-auto inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold shrink-0"
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
