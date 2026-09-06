import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ShieldCheck } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: gigs } = await supabase
    .from('gigs')
    .select('id, title, status')
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: payoutRequests } = await supabase
    .from('payout_requests')
    .select('id, amount, status, bank_account_name, bank_account_number, bank_ifsc, requested_at, freelancer_id, payout_method, failure_reason')
    .in('status', ['pending', 'processing'])
    .order('requested_at', { ascending: true })

  const { data: disputedOrders } = await supabase
    .from('gig_orders')
    .select('id, amount, dispute_reason, gig:gigs(title), buyer:profiles!buyer_id(full_name, email), seller:profiles!seller_id(full_name, email)')
    .eq('status', 'disputed')
    .order('updated_at', { ascending: true })

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <WorkspaceShell
      activeSection="admin"
      role={profile?.role}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Admin"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/subscription-tiers" className="text-sm font-medium text-gray-600 hover:text-blue-600 dark:text-gray-400">
              Posting tiers & credits →
            </Link>
            {/* AI providers/feature flags are platform-wide (llm_providers/
                llm_feature_flags have no per-app scoping), managed from
                this one panel rather than duplicated per app. */}
            <a href="https://stackworks.greyin.net/admin/llm" className="text-sm font-medium text-gray-600 hover:text-blue-600 dark:text-gray-400">
              Manage AI providers →
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Pending withdrawal requests</h2>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
              {decodeURIComponent(error)}
            </div>
          )}
          {payoutRequests && payoutRequests.length > 0 ? (
            <div className="divide-y">
              {payoutRequests.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">₹{p.amount.toLocaleString()} &middot; {p.bank_account_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      A/C {p.bank_account_number} &middot; {p.bank_ifsc} &middot; requested {new Date(p.requested_at).toLocaleDateString()}
                    </p>
                    {p.failure_reason && (
                      <p className="text-xs text-red-600 mt-1 dark:text-red-400">Last attempt failed: {p.failure_reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <form action="/api/admin/payouts/update" method="POST">
                      <input type="hidden" name="payout_id" value={p.id} />
                      <input type="hidden" name="status" value="paid" />
                      <button type="submit" className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300">
                        Mark paid
                      </button>
                    </form>
                    <form action="/api/admin/payouts/update" method="POST">
                      <input type="hidden" name="payout_id" value={p.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No pending withdrawal requests.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Disputed orders</h2>
          {disputedOrders && disputedOrders.length > 0 ? (
            <div className="divide-y">
              {disputedOrders.map((o: any) => (
                <div key={o.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{o.gig?.title || 'Order'} &middot; ₹{o.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Buyer: {o.buyer?.full_name || o.buyer?.email} &middot; Seller: {o.seller?.full_name || o.seller?.email}
                    </p>
                    {o.dispute_reason && <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">{o.dispute_reason}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action="/api/admin/orders/resolve-dispute" method="POST">
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="resolution" value="release" />
                      <button type="submit" className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300">
                        Release to freelancer
                      </button>
                    </form>
                    <form action="/api/admin/orders/resolve-dispute" method="POST">
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="resolution" value="refund" />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                        Refund buyer
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No disputed orders.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Gig listings</h2>
          {gigs && gigs.length > 0 ? (
            <div className="divide-y">
              {gigs.map((gig) => (
                <div key={gig.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{gig.title}</p>
                    <span className="text-xs text-gray-500 capitalize dark:text-gray-400">{gig.status}</span>
                  </div>
                  <form action="/api/admin/gigs/close" method="POST">
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

        <div className="bg-white rounded-lg shadow-md p-6 mt-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Users</h2>
          <div className="divide-y">
            {users?.map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                </div>
                <form action="/api/admin/users/update-role" method="POST" className="flex items-center gap-2">
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
    </WorkspaceShell>
  )
}
