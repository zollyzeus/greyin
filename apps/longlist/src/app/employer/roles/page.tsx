import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Users, Clock } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { createClient } from '@/lib/supabase/server'

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  filled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  expired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

export default async function EmployerRolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/employer/roles')

  const { data: company } = await supabase.from('companies').select('id, name').eq('user_id', user.id).maybeSingle()
  if (!company) redirect('/post')

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: roles } = await supabase
    .from('future_roles')
    .select('id, title, status, target_timeframe, created_at, future_role_subscriptions(count)')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })

  return (
    <WorkspaceShell
      activeSection="employer-roles"
      hasCompany={true}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Your Future Roles"
    >
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Your Future Roles</h1>
          <Link href="/post" className="bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-800">
            Post Another
          </Link>
        </div>

        {roles && roles.length > 0 ? (
          <div className="space-y-3">
            {roles.map((r: any) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4 flex-wrap dark:bg-gray-900 dark:border-gray-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-gray-50">{r.title}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 dark:text-gray-400">
                    <Clock className="h-3 w-3" /> {r.target_timeframe.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/employer/roles/${r.id}/candidates`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400">
                    <Users className="h-4 w-4" />
                    {r.future_role_subscriptions?.[0]?.count ?? 0} subscribed
                  </Link>
                  {r.status === 'open' && (
                    <>
                      <form action={`/api/future-roles/${r.id}/status`} method="POST">
                        <input type="hidden" name="status" value="filled" />
                        <button type="submit" className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
                          Mark filled
                        </button>
                      </form>
                      {/* 'expired' was already a real, notification-wired
                          status (the route accepts it, and 110 fixed the
                          subscriber-notify trigger to cover it) but had no
                          way for a poster to actually reach it -- found
                          while adding e2e coverage for FR-LL-05. Same
                          form/button shape as "Mark filled" above. */}
                      <form action={`/api/future-roles/${r.id}/status`} method="POST">
                        <input type="hidden" name="status" value="expired" />
                        <button type="submit" className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
                          Mark expired
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">You haven&rsquo;t posted a future role yet.</p>
        )}
      </div>
    </WorkspaceShell>
  )
}
