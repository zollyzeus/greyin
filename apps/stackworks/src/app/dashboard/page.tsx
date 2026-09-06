import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isBuilder } from '@/lib/stackworks-role'
import { absoluteUrl } from '@/lib/site-url'
import { FolderKanban, ClipboardList, Hammer, ShieldCheck, Users } from 'lucide-react'
import { EcosystemWidget } from '@/components/EcosystemWidget'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, is_verified_expert')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const builder = profile ? isBuilder(profile) : false

  const { data: memberships } = await supabase
    .from('pillar_memberships')
    .select('pillar')
    .eq('user_id', user.id)

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
    <WorkspaceShell
      activeSection="dashboard"
      builder={builder}
      isAdmin={profile?.role === 'admin'}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Dashboard"
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-1">Welcome, {profile?.full_name || (builder ? 'Builder' : 'Supporter')}!</h1>
        <p className="text-gray-600 mb-6 dark:text-gray-400">
          {builder
            ? (askCount ?? 0) > 0
              ? `You have posted ${askCount} ask${askCount === 1 ? '' : 's'}. Review who applies below.`
              : 'Post real asks on your projects and review who applies.'
            : 'Browse open asks and apply to help a Builder ship.'}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/projects" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <FolderKanban className="w-8 h-8 text-teal-600 mb-2 dark:text-teal-400" />
            <h2 className="text-xl font-semibold">Browse Projects</h2>
            <p className="text-gray-600 dark:text-gray-400">See what Builders are shipping and where they need help</p>
          </Link>
          <Link href="/applications" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <ClipboardList className="w-8 h-8 text-teal-600 mb-2 dark:text-teal-400" />
            <h2 className="text-xl font-semibold">My Applications</h2>
            <p className="text-gray-600 dark:text-gray-400">Track the asks you've applied to</p>
          </Link>
          <Link href="/people" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
            <Users className="w-8 h-8 text-teal-600 mb-2 dark:text-teal-400" />
            <h2 className="text-xl font-semibold">People</h2>
            <p className="text-gray-600 dark:text-gray-400">See Builders and Supporters with a verified track record</p>
          </Link>
          {builder && (
            <Link href="/projects/new" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
              <Hammer className="w-8 h-8 text-teal-600 mb-2 dark:text-teal-400" />
              <h2 className="text-xl font-semibold">Post a Project</h2>
              <p className="text-gray-600 dark:text-gray-400">Share what you're building and open asks for help</p>
            </Link>
          )}
          {profile?.role === 'admin' && (
            <Link href="/admin" className="p-6 bg-white rounded-lg shadow hover:shadow-lg dark:bg-gray-900">
              <ShieldCheck className="w-8 h-8 text-red-600 mb-2 dark:text-red-400" />
              <h2 className="text-xl font-semibold">Admin</h2>
              <p className="text-gray-600 dark:text-gray-400">Moderate projects and asks</p>
            </Link>
          )}
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-1">Your track record badge</h2>
          <p className="text-gray-500 text-sm mb-4 dark:text-gray-400">
            Embed your verified outcome count on a resume, LinkedIn, or personal site &mdash; no login required to view it.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/badge/${user.id}`} alt="StackWorks verified track record badge" width={300} height={60} />
            <textarea
              readOnly
              rows={2}
              className="flex-1 min-w-[260px] border border-gray-200 rounded-lg p-2 text-xs font-mono text-gray-600 bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:bg-gray-950"
              value={`[![StackWorks track record](${absoluteUrl(`/api/badge/${user.id}`)})](${absoluteUrl('/people')})`}
            />
          </div>
        </div>

        {myUpdates && myUpdates.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-4">My recent activity</h2>
            <div className="divide-y">
              {myUpdates.map((u: any) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                  <Link href={`/projects/${u.project_id}`} className="font-medium text-gray-900 hover:text-teal-600 dark:text-gray-50">
                    Update on {u.builder_projects?.title || 'project'}
                  </Link>
                  <form action={`/api/project-updates/${u.id}/feed-visibility`} method="POST" className="flex items-center gap-2">
                    <select
                      name="feed_visibility"
                      defaultValue={u.feed_visibility}
                      className="text-xs border border-gray-300 rounded-lg px-2 py-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers only</option>
                      <option value="private">Don&rsquo;t include</option>
                    </select>
                    <button type="submit" className="text-xs font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
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
    </WorkspaceShell>
  )
}
