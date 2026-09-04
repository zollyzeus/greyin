'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveNotificationHref } from '@/lib/notification-link'

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

/**
 * Gap-audit item #2: live notification bell, replacing the full-page-only
 * pattern /notifications had. Self-contained (own auth check, same
 * pattern as ImageUploader.tsx/FollowButton.tsx) rather than driven by
 * SiteHeader's own isLoggedIn state, since it needs the real user id for
 * its own queries and the Realtime subscription filter, not just a
 * boolean. Requires 102 (notifications added to the supabase_realtime
 * publication) and the Realtime service actually being able to reach
 * Postgres (a separate, pre-existing infra defect fixed the same day,
 * unrelated to this component).
 *
 * Opening the dropdown marks everything read, same eager-mark-read
 * behavior /notifications/page.tsx already has -- kept consistent rather
 * than inventing a per-item read state this codebase doesn't have
 * elsewhere.
 */
export function NotificationBell() {
  const [supabase] = useState(() => createClient())
  // SiteHeader mounts this twice (once in the desktop <nav>, once in the
  // collapsible mobile <nav>) -- both stay in the DOM regardless of which
  // is CSS-hidden at the current viewport, so two instances are alive at
  // once. A shared channel *name* isn't required for both to independently
  // receive the same postgres_changes event (each subscribed channel gets
  // it regardless), but two channels sharing one topic name did visibly
  // collide in practice (found via e2e: the badge count updated but the
  // dropdown's own item list on the clicked instance didn't) -- giving
  // each mount its own topic avoids that entirely.
  const [instanceId] = useState(() => Math.random().toString(36).slice(2))
  const [userId, setUserId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !user) return
      setUserId(user.id)

      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => {
          if (active && data) setItems(data as NotificationRow[])
        })

      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .then(({ count }) => {
          if (active) setUnreadCount(count || 0)
        })

      const channel = supabase
        .channel(`notifications:${user.id}:${instanceId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            setItems((prev) => [payload.new as NotificationRow, ...prev].slice(0, 5))
            setUnreadCount((c) => c + 1)
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })

    return () => {
      active = false
    }
  }, [supabase, instanceId])

  const handleToggle = async () => {
    const opening = !open
    setOpen(opening)
    if (opening && unreadCount > 0 && userId) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
      setUnreadCount(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  if (!userId) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 text-gray-700 hover:text-teal-600 dark:text-gray-300"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 dark:bg-gray-900 dark:border-gray-800">
          {items.length > 0 ? (
            <div className="divide-y max-h-96 overflow-y-auto">
              {items.map((n) => {
                const { href, external } = resolveNotificationHref(n)
                const body = (
                  <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 dark:text-gray-400">{n.body}</p>}
                  </div>
                )
                return external ? (
                  <a key={n.id} href={href} onClick={() => setOpen(false)}>{body}</a>
                ) : (
                  <Link key={n.id} href={href} onClick={() => setOpen(false)}>{body}</Link>
                )
              })}
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-gray-500 text-center dark:text-gray-400">No notifications yet.</p>
          )}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-sm font-medium text-teal-600 py-2.5 border-t hover:bg-gray-50 dark:text-teal-400 dark:hover:bg-gray-800"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
