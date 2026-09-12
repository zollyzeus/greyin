import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Telescope, Compass, Send, Briefcase, ArrowRight } from 'lucide-react'
import { EcosystemWidget } from '@/components/EcosystemWidget'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/dashboard')

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, is_verified_expert')
    .eq('user_id', user.id)
    .maybeSingle()

  const [{ count: openRoleCount }, { count: subscriptionCount }, { data: company }, { data: memberships }] = await Promise.all([
    supabase.from('future_roles_public').select('id', { count: 'exact', head: true }),
    supabase.from('future_role_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('companies').select('id, name').eq('user_id', user.id).maybeSingle(),
    supabase.from('pillar_memberships').select('pillar').eq('user_id', user.id),
  ])

  let postedRoleCount = 0
  if (company) {
    const { count } = await supabase.from('future_roles').select('id', { count: 'exact', head: true }).eq('company_id', company.id)
    postedRoleCount = count ?? 0
  }

  return (
    <WorkspaceShell
      activeSection="dashboard"
      hasCompany={!!company}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle="Dashboard"
    >
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2 dark:text-gray-50">
          <Telescope className="h-7 w-7 text-amber-700 dark:text-amber-400" />
          Your Longlist
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          <Link href="/roles" className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow group dark:bg-gray-900 dark:border-gray-800">
            <Compass className="h-7 w-7 text-amber-700 mb-3 dark:text-amber-400" />
            <h2 className="font-bold text-gray-900 mb-1 dark:text-gray-50">Browse Future Roles</h2>
            <p className="text-sm text-gray-600 mb-3 dark:text-gray-400">{openRoleCount ?? 0} open right now, all anonymized.</p>
            <span className="text-sm font-semibold text-amber-700 inline-flex items-center gap-1 group-hover:gap-2 transition-all dark:text-amber-400">
              Browse <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link href="/profile" className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow group dark:bg-gray-900 dark:border-gray-800">
            <Send className="h-7 w-7 text-amber-700 mb-3 dark:text-amber-400" />
            <h2 className="font-bold text-gray-900 mb-1 dark:text-gray-50">Your Future Interests</h2>
            <p className="text-sm text-gray-600 mb-3 dark:text-gray-400">
              {subscriptionCount ? `Subscribed to ${subscriptionCount} role${subscriptionCount === 1 ? '' : 's'}.` : 'Not subscribed to anything yet.'}
            </p>
            <span className="text-sm font-semibold text-amber-700 inline-flex items-center gap-1 group-hover:gap-2 transition-all dark:text-amber-400">
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
          <Briefcase className="h-7 w-7 text-amber-700 mb-3 dark:text-amber-400" />
          {company ? (
            <>
              <h2 className="font-bold text-gray-900 mb-1 dark:text-gray-50">Hiring later at {company.name}?</h2>
              <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
                {postedRoleCount > 0
                  ? `You have ${postedRoleCount} future role${postedRoleCount === 1 ? '' : 's'} posted.`
                  : "You haven't posted a future role yet."}
              </p>
              <div className="flex gap-3">
                <Link href="/post" className="bg-amber-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-800 transition">
                  Post a Future Role
                </Link>
                {postedRoleCount > 0 && (
                  <Link href="/employer/roles" className="border border-amber-700 text-amber-700 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-50 transition dark:text-amber-400 dark:hover:bg-amber-950/40">
                    View Your Roles
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="font-bold text-gray-900 mb-1 dark:text-gray-50">Hiring later on?</h2>
              <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
                Posting a future role needs a company profile first — that's set up on DeepEdge, and every
                Greyin pillar shares it.
              </p>
              <a href="https://deepedge.greyin.net/employer/dashboard" className="inline-block bg-amber-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-800 transition">
                Set Up Your Company on DeepEdge
              </a>
            </>
          )}
        </div>

        <div className="mt-8">
          <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />
        </div>
      </div>
    </WorkspaceShell>
  )
}
