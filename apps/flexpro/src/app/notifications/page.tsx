import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft, Bell } from 'lucide-react'
import { resolveNotificationHref } from '@/lib/notification-link'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/notifications')
  }

  // Mark everything unread as read the moment the page is viewed.
  await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              <span className="ml-2 text-2xl font-bold">FlexPro</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-blue-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

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
    </main>
  )
}
