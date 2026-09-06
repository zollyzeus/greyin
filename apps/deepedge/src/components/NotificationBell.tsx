'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveNotificationHref } from '@/lib/notification-link'
import { logEvent } from '@/lib/analytics'

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
 * 2026-09-06 update (UI/UX elevation plan, Phase 2): stopped marking
 * every notification read just from opening the dropdown -- each item is
 * now marked read individually on click/navigate, plus an explicit
 * "Mark all read" action (docs/ui_ux_elevation_plan.md). Added a
 * lightweight, dependency-free arrival toast -- a plain fixed-position
 * element, not a new npm package, since none of the other pillar apps
 * had a toast library installed and this codebase's own convention
 * favors small self-contained components over a new dependency for one
 * feature. Also added a 45s poll-refresh fallback for the unread count:
 * Realtime has a documented history of not always connecting in this
 * deployment, so a missed INSERT event now still surfaces within a
 * bounded time instead of silently never updating the badge.
 *
 * 2026-09-06 (Phase 2 close-out): dropped the instanceId-suffixed
 * channel topic that used to exist here -- it was working around
 * SiteHeader mounting this component twice (desktop nav + mobile nav,
 * one CSS-hidden by the other's breakpoint but both still mounted), so
 * two subscriptions on one shared topic name would collide (badge
 * updated but the clicked instance's own item list didn't). Fixed at
 * the real source instead: SiteHeader and WorkspaceShell now each
 * mount exactly one NotificationBell, so a single fixed topic name per
 * user is safe again.
 */
export function NotificationBell() {
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const [toastItem, setToastItem] = useState<NotificationRow | null>(null)

  useEffect(() => {
    let active = true
    let pollId: ReturnType<typeof setInterval> | undefined

    const refetchUnread = (uid: string) => {
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .eq('read', false)
        .then(({ count }) => {
          if (active) setUnreadCount(count || 0)
        })
    }

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

      refetchUnread(user.id)

      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as NotificationRow
            setItems((prev) => [row, ...prev].slice(0, 5))
            setUnreadCount((c) => c + 1)
            setToastItem(row)
          }
        )
        .subscribe()

      pollId = setInterval(() => refetchUnread(user.id), 45000)

      return () => {
        supabase.removeChannel(channel)
      }
    })

    return () => {
      active = false
      if (pollId) clearInterval(pollId)
    }
  }, [supabase])

  useEffect(() => {
    if (!toastItem) return
    const t = setTimeout(() => setToastItem(null), 5000)
    return () => clearTimeout(t)
  }, [toastItem])

  const markOneRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  const markAllRead = async () => {
    if (!userId) return
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  }

  if (!userId) return null

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => {
              const next = !v
              if (next && userId) logEvent(supabase, userId, 'notification_bell_open')
              return next
            })
          }}
          className="relative p-2 text-gray-700 hover:text-indigo-600 dark:text-gray-300"
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
            <div className="flex items-center justify-between px-4 py-2 border-b dark:border-gray-800">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  data-testid="mark-all-read"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:opacity-80"
                >
                  Mark all read
                </button>
              )}
            </div>
            {items.length > 0 ? (
              <div className="divide-y dark:divide-gray-800 max-h-96 overflow-y-auto">
                {items.map((n) => {
                  const { href, external } = resolveNotificationHref(n)
                  const body = (
                    <div className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 ${n.read ? '' : 'bg-indigo-50/60 dark:bg-indigo-950/20'}`}>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{n.title}</p>
                      {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>}
                    </div>
                  )
                  const onClick = () => {
                    setOpen(false)
                    if (!n.read) markOneRead(n.id)
                  }
                  return external ? (
                    <a key={n.id} href={href} onClick={onClick}>{body}</a>
                  ) : (
                    <Link key={n.id} href={href} onClick={onClick}>{body}</Link>
                  )
                })}
              </div>
            ) : (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">No notifications yet.</p>
            )}
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-indigo-600 py-2.5 border-t hover:bg-gray-50 dark:text-indigo-400 dark:hover:bg-gray-800"
            >
              View all
            </Link>
          </div>
        )}
      </div>

      {toastItem && (
        <div
          role="status"
          aria-live="polite"
          data-testid="notification-toast"
          className="fixed bottom-4 right-4 z-[60] w-80 rounded-lg border border-gray-200 bg-white shadow-lg p-4 dark:bg-gray-900 dark:border-gray-800"
        >
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{toastItem.title}</p>
              {toastItem.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{toastItem.body}</p>}
            </div>
            <button
              type="button"
              onClick={() => setToastItem(null)}
              aria-label="Dismiss"
              data-testid="notification-toast-dismiss"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
