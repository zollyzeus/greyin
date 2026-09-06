import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Bell } from 'lucide-react'
import { resolveNotificationHref } from '@/lib/notification-link'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/notifications')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  // Mark everything unread as read the moment the page is viewed.
  await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <WorkspaceShell
      role={profile?.role}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Notifications"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Notifications</h1>
        </div>

        <div className="bg-white rounded-lg shadow-md divide-y dark:bg-gray-900">
          {notifications && notifications.length > 0 ? (
            notifications.map((n) => {
              const { href, external } = resolveNotificationHref(n)
              const content = (
                <>
                  <p className="font-medium text-gray-900 dark:text-gray-50">{n.title}</p>
                  {n.body && <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">{new Date(n.created_at).toLocaleString()}</p>
                </>
              )
              // Cross-pillar notifications (see notification-link.ts) point
              // at another app's own domain -- a plain <a> for those, an
              // in-app <Link> when it resolves to this same app.
              return external ? (
                <a key={n.id} href={href} className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  {content}
                </a>
              ) : (
                <Link key={n.id} href={href} className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  {content}
                </Link>
              )
            })
          ) : (
            <p className="p-6 text-gray-500 text-sm dark:text-gray-400">No notifications yet.</p>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
