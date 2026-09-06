import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin, Clock } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { createClient } from '@/lib/supabase/server'

const TIMEFRAME_LABEL: Record<string, string> = {
  '3_months': '~3 months out',
  '6_months': '~6 months out',
  '9_months': '~9 months out',
  '12_months': '~12 months out',
}

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/roles')

  const [{ data: roles }, { data: mySubs }, { data: profile }, { data: scoreRow }, { data: company }] = await Promise.all([
    supabase
      .from('future_roles_public')
      .select('id, title, function_area, seniority_level, target_timeframe, description, skills, location, is_remote, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('future_role_subscriptions').select('future_role_id').eq('user_id', user.id),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle(),
    supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle(),
  ])

  const subscribedIds = new Set((mySubs || []).map((s) => s.future_role_id))

  return (
    <WorkspaceShell
      activeSection="roles"
      hasCompany={!!company}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Future Roles"
    >
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 dark:text-gray-50">Future Roles</h1>
        <p className="text-gray-600 mb-8 dark:text-gray-400">
          Company identity is withheld on every listing below. Subscribing tells that company you&rsquo;re
          future-interested — nothing more.
        </p>

        {roles && roles.length > 0 ? (
          <div className="space-y-4">
            {roles.map((r) => {
              const subscribed = subscribedIds.has(r.id)
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <Link href={`/roles/${r.id}`} className="text-lg font-bold text-gray-900 hover:text-amber-700 dark:text-gray-50 dark:hover:text-amber-300">
                        {r.title}
                      </Link>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                        {r.seniority_level && <span>{r.seniority_level}</span>}
                        {r.function_area && <span>&middot; {r.function_area}</span>}
                        {r.location && (
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{r.location}{r.is_remote ? ' (remote ok)' : ''}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 inline-flex items-center gap-1 whitespace-nowrap dark:bg-amber-950/40 dark:text-amber-400">
                      <Clock className="h-3 w-3" />
                      {TIMEFRAME_LABEL[r.target_timeframe] ?? r.target_timeframe}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-3 line-clamp-2 dark:text-gray-400">{r.description}</p>
                  {r.skills && r.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.skills.map((s: string) => (
                        <span key={s} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full dark:bg-gray-800 dark:text-gray-300">{s}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <Link href={`/roles/${r.id}`} className="text-sm font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400">View details</Link>
                    <form action={`/api/future-roles/${r.id}/${subscribed ? 'unsubscribe' : 'subscribe'}`} method="POST">
                      <button
                        type="submit"
                        className={
                          subscribed
                            ? 'text-sm px-4 py-2 rounded-lg border border-amber-700 text-amber-700 hover:bg-amber-50 font-semibold dark:text-amber-400 dark:hover:bg-amber-950/40'
                            : 'text-sm px-4 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 font-semibold'
                        }
                      >
                        {subscribed ? "You're future-interested" : "I'm future-interested"}
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No future roles posted yet. Check back soon.</p>
        )}
      </div>
    </WorkspaceShell>
  )
}
