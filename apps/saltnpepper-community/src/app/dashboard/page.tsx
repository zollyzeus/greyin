import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { sweepUnscoredReplies } from '@/lib/reply-quality'
import { Users, MessageSquare, MessageCircle, Settings, LogOut, ShieldCheck, Rss } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationBell } from '@/components/NotificationBell'
import { EcosystemWidget } from '@/components/EcosystemWidget'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  // Platform-wide safety net -- unlike the per-thread catch-up on
  // discussions/[id]/page.tsx, this isn't scoped to whatever thread
  // someone happens to open. /dashboard is something every logged-in
  // member hits routinely, so this is what actually guarantees the
  // backlog keeps draining even for threads nobody revisits.
  await sweepUnscoredReplies()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await supabase
    .from('pillar_memberships')
    .select('pillar')
    .eq('user_id', user.id)

  const { data: myDiscussions } = await supabase
    .from('discussions')
    .select('id, title, created_at, feed_visibility')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Gap-audit item #10 -- personalized activity line, same pattern as
  // Longlist's dashboard (count-only query, plain-English sentence).
  const { count: discussionCount } = await supabase
    .from('discussions')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-950 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <a href="https://greyin.net" className="flex items-center gap-2 text-xl font-bold text-purple-600 dark:text-purple-400">
              <Users className="w-6 h-6" />
              <span>Salt&Pepper</span>
            </a>
            <div className="flex items-center gap-4">
              <Link href="/feed" className="p-2" title="Feed">
                <Rss className="w-5 h-5" />
              </Link>
              <NotificationBell />
              <Link href="/profile" className="p-2" title="Profile">
                <Settings className="w-5 h-5" />
              </Link>
                <ThemeToggle />
              <form action="/auth/logout" method="POST">
                <button className="flex items-center gap-2 px-4 py-2">
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-1">Welcome, {profile?.full_name || 'Member'}!</h1>
        <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
          {(discussionCount ?? 0) > 0
            ? `You have started ${discussionCount} discussion${discussionCount === 1 ? '' : 's'}.`
            : "You haven't started a discussion yet."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/discussions" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <MessageSquare className="w-8 h-8 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold">Discussions</h2>
            <p className="text-gray-600 dark:text-gray-400">Browse and join discussions</p>
          </Link>
          <Link href="/discussions/new" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <Users className="w-8 h-8 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold">Start Discussion</h2>
            <p className="text-gray-600 dark:text-gray-400">Create a new discussion topic</p>
          </Link>
          <Link href="/messages" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <MessageCircle className="w-8 h-8 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="text-xl font-semibold">Messages</h2>
            <p className="text-gray-600 dark:text-gray-400">Direct conversations with other members</p>
          </Link>
          {profile?.role === 'admin' && (
            <Link href="/admin" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
              <ShieldCheck className="w-8 h-8 text-red-600 mb-2 dark:text-red-400" />
              <h2 className="text-xl font-semibold">Admin</h2>
              <p className="text-gray-600 dark:text-gray-400">Moderate discussions and projects</p>
            </Link>
          )}
        </div>

        {myDiscussions && myDiscussions.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-4">My recent activity</h2>
            <div className="divide-y">
              {myDiscussions.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between gap-4">
                  <Link href={`/discussions/${d.id}`} className="font-medium text-gray-900 hover:text-indigo-600 dark:text-gray-50">
                    {d.title}
                  </Link>
                  <form action={`/api/discussions/${d.id}/feed-visibility`} method="POST" className="flex items-center gap-2">
                    <select
                      name="feed_visibility"
                      defaultValue={d.feed_visibility}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Don&rsquo;t include</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8">
          <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />
        </div>
      </div>
    </div>
  )
}
