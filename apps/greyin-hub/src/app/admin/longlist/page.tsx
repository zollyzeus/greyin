import { createClient } from '@/lib/supabase/server'
import { Telescope } from 'lucide-react'

// Built from scratch (Phase 3, pitch-readiness plan) -- Longlist had no
// admin surface at all before this (confirmed via a fresh audit,
// 2026-09-08). Needed a new admin RLS bypass policy first (140), since
// neither future_roles nor future_role_subscriptions had one -- see
// that migration's header comment.
export default async function LonglistAdminPage() {
  const supabase = await createClient()

  const { data: roles } = await supabase
    .from('future_roles')
    .select('id, title, status, target_timeframe, companies ( name )')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: subscriptions } = await supabase
    .from('future_role_subscriptions')
    .select('future_role_id')

  const subscriberCountByRole = new Map<string, number>()
  for (const s of subscriptions || []) {
    subscriberCountByRole.set(s.future_role_id, (subscriberCountByRole.get(s.future_role_id) || 0) + 1)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Telescope className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Longlist</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">Future role postings</h2>
        {roles && roles.length > 0 ? (
          <div className="divide-y">
            {roles.map((r: any) => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {r.companies?.name} &middot; {r.target_timeframe.replace('_', ' ')} &middot; {r.status} &middot;{' '}
                    {subscriberCountByRole.get(r.id) || 0} subscriber{(subscriberCountByRole.get(r.id) || 0) === 1 ? '' : 's'}
                  </p>
                </div>
                {r.status !== 'expired' && (
                  <form action="/api/admin/longlist/future-roles/expire" method="POST">
                    <input type="hidden" name="future_role_id" value={r.id} />
                    <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      Expire
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">No future role postings yet.</p>
        )}
      </div>
    </div>
  )
}
