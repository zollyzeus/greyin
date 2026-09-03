import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isBuilder } from '@/lib/stackworks-role'
import { absoluteUrl } from '@/lib/site-url'
import { FlaskConical, FolderKanban, ClipboardList, Hammer, Settings, LogOut, ShieldCheck, Users, Bell, Rss } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const builder = profile ? isBuilder(profile) : false

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)

  const { data: myUpdates } = await supabase
    .from('project_updates')
    .select('id, body, created_at, feed_visibility, project_id, builder_projects:project_id ( title )')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Gap-audit item #10 -- personalized activity line, same pattern as
  // Longlist's dashboard (count-only query, plain-English sentence).
  const { count: askCount } = builder
    ? await supabase.from('project_asks').select('id', { count: 'exact', head: true }).eq('created_by', user.id)
    : { count: 0 }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <a href="https://greyin.net" className="flex items-center gap-2 text-xl font-bold text-teal-600">
              <FlaskConical className="w-6 h-6" />
              <span>StackWorks</span>
            </a>
            <div className="flex items-center gap-4">
              <Link href="/feed" className="p-2" title="Feed">
                <Rss className="w-5 h-5" />
              </Link>
              <Link href="/notifications" className="relative p-2" title="Notifications">
                <Bell className="w-5 h-5" />
                {!!unreadCount && (
                  <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="p-2" title="Profile">
                <Settings className="w-5 h-5" />
              </Link>
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
        <h1 className="text-3xl font-bold mb-1">Welcome, {profile?.full_name || (builder ? 'Builder' : 'Supporter')}!</h1>
        <p className="text-gray-600 mb-6">
          {builder
            ? (askCount ?? 0) > 0
              ? `You have posted ${askCount} ask${askCount === 1 ? '' : 's'}. Review who applies below.`
              : 'Post real asks on your projects and review who applies.'
            : 'Browse open asks and apply to help a Builder ship.'}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/projects" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
            <FolderKanban className="w-8 h-8 text-teal-600 mb-2" />
            <h2 className="text-xl font-semibold">Browse Projects</h2>
            <p className="text-gray-600">See what Builders are shipping and where they need help</p>
          </Link>
          <Link href="/applications" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
            <ClipboardList className="w-8 h-8 text-teal-600 mb-2" />
            <h2 className="text-xl font-semibold">My Applications</h2>
            <p className="text-gray-600">Track the asks you've applied to</p>
          </Link>
          <Link href="/people" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
            <Users className="w-8 h-8 text-teal-600 mb-2" />
            <h2 className="text-xl font-semibold">People</h2>
            <p className="text-gray-600">See Builders and Supporters with a verified track record</p>
          </Link>
          {builder && (
            <Link href="/projects/new" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
              <Hammer className="w-8 h-8 text-teal-600 mb-2" />
              <h2 className="text-xl font-semibold">Post a Project</h2>
              <p className="text-gray-600">Share what you're building and open asks for help</p>
            </Link>
          )}
          {profile?.role === 'admin' && (
            <Link href="/admin" className="p-6 bg-white rounded-lg shadow hover:shadow-lg">
              <ShieldCheck className="w-8 h-8 text-red-600 mb-2" />
              <h2 className="text-xl font-semibold">Admin</h2>
              <p className="text-gray-600">Moderate projects and asks</p>
            </Link>
          )}
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-1">Your track record badge</h2>
          <p className="text-gray-500 text-sm mb-4">
            Embed your verified outcome count on a resume, LinkedIn, or personal site &mdash; no login required to view it.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/badge/${user.id}`} alt="StackWorks verified track record badge" width={300} height={60} />
            <textarea
              readOnly
              rows={2}
              className="flex-1 min-w-[260px] border border-gray-200 rounded-lg p-2 text-xs font-mono text-gray-600 bg-gray-50"
              value={`[![StackWorks track record](${absoluteUrl(`/api/badge/${user.id}`)})](${absoluteUrl('/people')})`}
            />
          </div>
        </div>

        {myUpdates && myUpdates.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">My recent activity</h2>
            <div className="divide-y">
              {myUpdates.map((u: any) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                  <Link href={`/projects/${u.project_id}`} className="font-medium text-gray-900 hover:text-teal-600">
                    Update on {u.builder_projects?.title || 'project'}
                  </Link>
                  <form action={`/api/project-updates/${u.id}/feed-visibility`} method="POST" className="flex items-center gap-2">
                    <select
                      name="feed_visibility"
                      defaultValue={u.feed_visibility}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Don&rsquo;t include</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-teal-600 hover:text-teal-700">
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
