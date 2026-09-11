import { createClient } from '@/lib/supabase/server'
import { Package, ExternalLink } from 'lucide-react'

// Ported from apps/flexpro/src/app/admin/page.tsx (Phase 3, pitch-
// readiness plan). Gig listings and user roles are ported fully (simple,
// non-financial DB updates, same as DeepEdge's tab). Payout requests and
// disputed orders are shown here for VISIBILITY/monitoring only -- their
// real actions (marking a payout paid can trigger a live RazorpayX bank
// transfer; resolving a dispute can trigger a live Razorpay refund) stay
// on FlexPro's own admin page rather than duplicating real-money-movement
// code across two codebases, which would double the surface for a
// payment bug rather than consolidate anything. The original FlexPro-
// hosted page stays live, unmodified.
export default async function FlexProAdminPage() {
  const supabase = await createClient()

  const { data: gigs } = await supabase
    .from('gigs')
    .select('id, title, status')
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: payoutRequests } = await supabase
    .from('payout_requests')
    .select('id, amount, status, bank_account_name, requested_at')
    .in('status', ['pending', 'processing'])
    .order('requested_at', { ascending: true })

  const { data: disputedOrders } = await supabase
    .from('gig_orders')
    .select('id, amount, dispute_reason, gig:gigs(title)')
    .eq('status', 'disputed')
    .order('updated_at', { ascending: true })

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">FlexPro</h1>
        </div>
        <a href="https://flexpro.greyin.net/admin/subscription-tiers" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          Posting Tiers <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Pending withdrawal requests</h2>
          <a href="https://flexpro.greyin.net/admin" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
            Manage on FlexPro <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {payoutRequests && payoutRequests.length > 0 ? (
          <div className="divide-y">
            {payoutRequests.map((p) => (
              <div key={p.id} className="py-3">
                <p className="font-medium">₹{p.amount.toLocaleString()} &middot; {p.bank_account_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  requested {new Date(p.requested_at).toLocaleDateString()} &middot; {p.status}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">No pending withdrawal requests.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Disputed orders</h2>
          <a href="https://flexpro.greyin.net/admin" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
            Manage on FlexPro <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {disputedOrders && disputedOrders.length > 0 ? (
          <div className="divide-y">
            {disputedOrders.map((o: any) => (
              <div key={o.id} className="py-3">
                <p className="font-medium">{o.gig?.title || 'Order'} &middot; ₹{o.amount.toLocaleString()}</p>
                {o.dispute_reason && <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">{o.dispute_reason}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">No disputed orders.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">Gig listings</h2>
        {gigs && gigs.length > 0 ? (
          <div className="divide-y">
            {gigs.map((gig) => (
              <div key={gig.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{gig.title}</p>
                  <span className="text-xs text-gray-500 capitalize dark:text-gray-400">{gig.status}</span>
                </div>
                <form action="/api/admin/flexpro/gigs/close" method="POST">
                  <input type="hidden" name="gig_id" value={gig.id} />
                  <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                    Close listing
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">No active gig listings.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">Users</h2>
        <div className="divide-y">
          {users?.map((u) => (
            <div key={u.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{u.full_name || u.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
              </div>
              <form action="/api/admin/flexpro/users/update-role" method="POST" className="flex items-center gap-2">
                <input type="hidden" name="user_id" value={u.id} />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 capitalize dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  {['client', 'freelancer', 'admin'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button type="submit" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                  Update
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
