import { redirect, notFound } from 'next/navigation'
import { UserCheck, Sparkles } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { createClient } from '@/lib/supabase/server'
import { matchCandidatesForRole } from '@/lib/match-candidates'

export default async function RoleCandidatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/employer/roles/${id}/candidates`)

  // RLS's own "Employer manages own future roles" policy (087) is what
  // actually prevents reading someone else's role here -- this select
  // simply comes back empty for a non-owner, same as any other
  // owner-scoped page on the platform.
  const { data: role } = await supabase
    .from('future_roles')
    .select('id, title, description, skills, function_area, seniority_level, status')
    .eq('id', id)
    .maybeSingle()

  if (!role) notFound()

  const { data: subs } = await supabase
    .from('future_role_subscriptions')
    .select('user_id, created_at')
    .eq('future_role_id', id)
    .order('created_at', { ascending: false })

  const subscriberIds = (subs || []).map((s) => s.user_id)
  const { data: subscriberProfiles } = subscriberIds.length
    ? await supabase.from('profiles').select('id, full_name, location').in('id', subscriberIds)
    : { data: [] }

  const aiMatches = await matchCandidatesForRole(
    { title: role.title, description: role.description, skills: role.skills, function_area: role.function_area, seniority_level: role.seniority_level },
    subscriberIds
  )

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  return (
    <WorkspaceShell
      activeSection="employer-roles"
      hasCompany={true}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle={role.title}
    >
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-50">{role.title}</h1>
        <p className="text-gray-500 mb-8 dark:text-gray-400">Candidates for this role — never shown together on a public page, only here.</p>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 dark:bg-gray-900 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2 dark:text-gray-50">
            <UserCheck className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            Subscribed ({subscriberProfiles?.length ?? 0})
          </h2>
          {subscriberProfiles && subscriberProfiles.length > 0 ? (
            <div className="divide-y">
              {subscriberProfiles.map((p) => (
                <div key={p.id} className="py-3">
                  <p className="font-medium text-gray-900 dark:text-gray-50">{p.full_name ?? 'Unnamed member'}</p>
                  {p.location && <p className="text-xs text-gray-500 dark:text-gray-400">{p.location}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No one has subscribed to this role yet.</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2 dark:text-gray-50">
            <Sparkles className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            AI-surfaced ({aiMatches.length})
          </h2>
          <p className="text-xs text-gray-500 mb-4 dark:text-gray-400">Matched on stated future interests — they never subscribed to this specific role.</p>
          {aiMatches.length > 0 ? (
            <div className="divide-y">
              {aiMatches.map((m) => (
                <div key={m.user_id} className="py-3">
                  <p className="font-medium text-gray-900 dark:text-gray-50">{m.full_name ?? 'Unnamed member'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.reason}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No AI matches yet — this needs an admin to enable matching, or no profile currently fits.</p>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
