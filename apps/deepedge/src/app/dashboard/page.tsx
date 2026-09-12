import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Briefcase, Users, FileText, Settings, LogOut, MessageCircle, BellPlus, BadgeCheck, ArrowUpRight, Vote } from 'lucide-react'
import { EcosystemWidget } from '@/components/EcosystemWidget'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?next=/dashboard')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Employers get the dedicated, fuller dashboard at /employer/dashboard.
  if (profile?.role === 'employer') {
    redirect('/employer/dashboard')
  }

  const { data: memberships } = await supabase
    .from('pillar_memberships')
    .select('pillar')
    .eq('user_id', user.id)

  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, is_verified_expert')
    .eq('user_id', user.id)
    .maybeSingle()
  const isVerifiedExpert = !!scoreRow?.is_verified_expert

  // Salary trend watches (063) get their lazy sweep here -- this page
  // load is as good a trigger as any, same "do this user's overdue
  // work while they're here" shape as finalize_completed_mentor_sessions.
  await supabase.rpc('sweep_salary_trend_alerts')

  // Two-sided proactive matchmaking, candidate side (Phase D3, 134) --
  // same lazy-sweep shape as the salary-trend sweep above, notifying on
  // a real open-job match the candidate hasn't seen or applied to yet.
  await supabase.rpc('sweep_proactive_job_matches_for_candidate')

  // In-app weekly digest (competitive audit, Aug 2026): the retention
  // lever without a real email send, given the shared SMTP provider's
  // known rate-limit issue. notifications is one shared table written
  // to by every pillar (017/051), so this already reflects cross-pillar
  // activity, not just DeepEdge's own.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: weekNotifications } = await supabase
    .from('notifications')
    .select('type')
    .eq('user_id', user.id)
    .gte('created_at', weekAgo)
  const digestCounts = (weekNotifications || []).reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1
    return acc
  }, {})
  const digestTotal = weekNotifications?.length || 0

  // Gap-audit item #10 ("your activity" dashboard cards) -- this page's own
  // Quick Stats section already existed but had hardcoded 0s for every tile.
  // Applications is real and cheap to wire (applications.candidate_id ->
  // candidates.id -> user_id); Saved Jobs and Profile Views stay static since
  // neither has a backing feature (no saved-jobs table, no per-candidate
  // profile-view counter) -- left as-is rather than inventing tracking out of
  // scope for this pass, not silently left as if already real.
  const { data: candidateRow } = await supabase.from('candidates').select('id').eq('user_id', user.id).maybeSingle()
  const { count: applicationCount } = candidateRow
    ? await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateRow.id)
    : { count: 0 }

  // Profile-view insights (Skillmeet.ai comparison round, 2026-09-12):
  // the tile above was hardcoded 0 since the 2026-09-05 integrity audit
  // explicitly flagged there was no backing counter -- profile_views
  // (150) is that counter now. viewer_names comes back non-null only if
  // this candidate holds an active candidate_subscriptions row.
  const { data: viewSummary } = await supabase.rpc('get_profile_view_summary')
  const weeklyViewCount = viewSummary?.[0]?.view_count ?? 0
  const viewerNames: string[] | null = viewSummary?.[0]?.viewer_names ?? null

  return (
    <WorkspaceShell
      activeSection="dashboard"
      userName={profile?.full_name || 'User'}
      verified={isVerifiedExpert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle="Dashboard"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
            Welcome back, {profile?.full_name || 'User'}!
          </h1>
          <p className="text-gray-600 mt-2 dark:text-gray-400">
            Explore job opportunities and track your applications
          </p>
        </div>

        {/* Verified Expert status */}
        {isVerifiedExpert ? (
          <div className="mb-8 flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400">
            <BadgeCheck className="h-5 w-5 shrink-0" />
            Verified Expert{scoreRow?.greyin_score != null ? ` · Greyin Score ${scoreRow.greyin_score}` : ''} — you can apply to jobs and appear in employer candidate search.
          </div>
        ) : (
          <div className="mb-8 rounded-lg bg-amber-50 border border-amber-200 px-6 py-5 dark:bg-amber-950/40 dark:border-amber-900">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              Applying to jobs requires Verified Expert status
            </p>
            <p className="text-sm text-amber-800 mt-1 dark:text-amber-400">
              You need senior-level experience, or a Greyin Score of 75+{scoreRow?.greyin_score != null ? ` (yours is currently ${scoreRow.greyin_score})` : ''}, to submit applications and appear in employer candidate search. Build your score by being active on:
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a href="https://stackworks.greyin.net" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400">
                StackWorks <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a href="https://flexpro.greyin.net" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-orange-700 hover:text-orange-800 dark:text-orange-400">
                FlexPro <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a href="https://saltnpepper.greyin.net" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-800 dark:text-purple-400">
                Salt &amp; Pepper <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* This week's digest -- in-app only, see comment above on why */}
        <div className="mb-8 bg-white rounded-lg shadow p-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 dark:text-gray-50">This week across Greyin</h2>
          {digestTotal > 0 ? (
            <>
              <p className="text-sm text-gray-500 mb-3 dark:text-gray-400">{digestTotal} update{digestTotal === 1 ? '' : 's'} in the last 7 days</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(digestCounts).map(([type, count]) => (
                  <span key={type} className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full dark:bg-blue-950/40 dark:text-blue-400">
                    {count}&times; {type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <Link href="/notifications" className="inline-block mt-3 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                View all &rarr;
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nothing new this week yet.</p>
          )}
        </div>

        {/* Pivoter nudge */}
        {profile?.is_pivoter && (
          <div className="mb-8 rounded-lg bg-orange-50 border border-orange-200 px-6 py-5 dark:bg-orange-950/40 dark:border-orange-900">
            <p className="text-sm font-semibold text-orange-900 dark:text-orange-300">
              Pivoting from {profile.pivot_from_domain || 'your current domain'} to {profile.pivot_to_domain || 'a new one'}
            </p>
            <p className="text-sm text-orange-800 mt-1 dark:text-orange-400">
              You'll only show up in job applications for roles explicitly &quot;open to career changers,&quot; not the
              general Verified Expert search. Build a track record in the new domain, or find someone who's
              already made a similar jump:
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a href="https://stackworks.greyin.net" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400">
                Build on StackWorks <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a href="https://saltnpepper.greyin.net/mentors" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-800 dark:text-purple-400">
                Find a mentor <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Re-entry nudge -- unlike the pivoter banner above, this candidate
            shows up everywhere normally; the tag is additive context, not a
            restricted path, so the copy stays encouraging rather than
            explaining a limitation. */}
        {profile?.is_reentry && (
          <div className="mb-8 rounded-lg bg-blue-50 border border-blue-200 px-6 py-5 dark:bg-blue-950/40 dark:border-blue-900">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
              Your profile notes your return to work
            </p>
            <p className="text-sm text-blue-800 mt-1 dark:text-blue-400">
              This helps employers read a gap in your timeline in context instead of as a red flag — you show
              up in candidate search and job applications exactly as any other Verified Expert. Want peer
              support from someone who's done the same?
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a href="https://saltnpepper.greyin.net/mentors" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-purple-700 hover:text-purple-800 dark:text-purple-400">
                Find a mentor <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm dark:text-gray-400">Applications</p>
                <p className="text-3xl font-bold text-gray-900 mt-2 dark:text-gray-50">{applicationCount || 0}</p>
              </div>
              <Briefcase className="h-12 w-12 text-blue-500 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm dark:text-gray-400">Saved Jobs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2 dark:text-gray-50">0</p>
              </div>
              <FileText className="h-12 w-12 text-green-500 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm dark:text-gray-400">Profile Views (7d)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2 dark:text-gray-50">{weeklyViewCount}</p>
              </div>
              <Users className="h-12 w-12 text-purple-500 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Who viewed you -- free tier gets the count above only;
            viewerNames comes back non-null exclusively for an active
            candidate_subscriptions holder (get_profile_view_summary, 150). */}
        {weeklyViewCount > 0 && (
          <div className="mb-8 bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 mb-1 dark:text-gray-50">Who viewed your profile</h2>
            {viewerNames ? (
              <ul className="mt-3 space-y-1.5">
                {viewerNames.map((name, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{name}</li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                  {weeklyViewCount} employer{weeklyViewCount === 1 ? '' : 's'} viewed your profile this week. Upgrade to Profile Insights to see exactly who.
                </p>
                <Link href="/premium" className="inline-block mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                  See who viewed you &rarr;
                </Link>
              </>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow dark:bg-gray-900">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Quick Actions</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/jobs"
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition dark:border-gray-800"
              >
                <Briefcase className="h-10 w-10 text-blue-600 mr-4 dark:text-blue-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">Browse Jobs</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Find your next opportunity</p>
                </div>
              </Link>

              <Link
                href="/dashboard/applications"
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition dark:border-gray-800"
              >
                <FileText className="h-10 w-10 text-green-600 mr-4 dark:text-green-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">My Applications</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Track your application status</p>
                </div>
              </Link>

              <Link
                href="/profile"
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition dark:border-gray-800"
              >
                <Users className="h-10 w-10 text-purple-600 mr-4 dark:text-purple-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">Edit Profile</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Update your profile and resume</p>
                </div>
              </Link>

              <Link
                href="/companies"
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition dark:border-gray-800"
              >
                <Settings className="h-10 w-10 text-gray-600 mr-4 dark:text-gray-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">Browse Companies</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Explore companies that are hiring</p>
                </div>
              </Link>

              <Link
                href="/messages"
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition dark:border-gray-800"
              >
                <MessageCircle className="h-10 w-10 text-blue-600 mr-4 dark:text-blue-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">Messages</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Conversations with employers</p>
                </div>
              </Link>

              <Link
                href="/dashboard/alerts"
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition dark:border-gray-800"
              >
                <BellPlus className="h-10 w-10 text-blue-600 mr-4 dark:text-blue-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">Job Alerts</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Get notified about matching jobs</p>
                </div>
              </Link>

              <Link
                href="/governance/threshold"
                className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition dark:border-gray-800"
              >
                <Vote className="h-10 w-10 text-indigo-600 mr-4 dark:text-indigo-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">Have a Say</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Vote on the eligibility bar</p>
                </div>
              </Link>

              {profile?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition dark:border-gray-800"
                >
                  <Settings className="h-10 w-10 text-red-600 mr-4 dark:text-red-400" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">Admin</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Moderate listings and view users</p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="mt-8">
          <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />
        </div>
      </div>
    </WorkspaceShell>
  )
}
