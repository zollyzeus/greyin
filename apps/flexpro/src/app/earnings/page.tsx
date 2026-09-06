import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Wallet } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

const PLATFORM_FEE_RATE = 0.02

export default async function EarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/earnings')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_mentor')
    .eq('id', user.id)
    .single()

  // Mentors can earn from bookable session gigs (056_mentor_sessions.sql)
  // regardless of role='freelancer' -- their income flows through this
  // same payout_requests/gig_orders machinery, so they need to be able
  // to see and withdraw it.
  if (profile?.role !== 'freelancer' && !profile?.is_mentor) {
    redirect('/dashboard')
  }

  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: completedOrders } = await supabase
    .from('gig_orders')
    .select('amount')
    .eq('seller_id', user.id)
    .eq('status', 'completed')

  const { data: payoutRequests } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('freelancer_id', user.id)
    .order('requested_at', { ascending: false })

  const totalEarned = (completedOrders || []).reduce((sum, o) => sum + o.amount, 0)
  const netEarned = Math.round(totalEarned * (1 - PLATFORM_FEE_RATE))
  const alreadyClaimed = (payoutRequests || [])
    .filter((p) => p.status !== 'rejected')
    .reduce((sum, p) => sum + p.amount, 0)
  const available = Math.max(0, netEarned - alreadyClaimed)

  return (
    <WorkspaceShell
      activeSection="earnings"
      role={profile?.role}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Earnings"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-6">
            <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Earnings</h1>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center mb-2">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total earned</p>
              <p className="text-xl font-bold" id="total-earned">₹{netEarned.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Already requested</p>
              <p className="text-xl font-bold" id="already-claimed">₹{alreadyClaimed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Available balance</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400" id="available-balance">₹{available.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center dark:text-gray-500">
            Earnings shown after the platform&apos;s {PLATFORM_FEE_RATE * 100}% service fee. Based on completed orders only.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Request a withdrawal</h2>
          {available > 0 ? (
            <form action="/api/payouts/request" method="POST" className="space-y-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount (₹)</label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min={1}
                  max={available}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder={`Up to ₹${available.toLocaleString()}`}
                />
              </div>
              <div>
                <label htmlFor="bank_account_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account holder name</label>
                <input
                  id="bank_account_name"
                  name="bank_account_name"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bank_account_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account number</label>
                  <input
                    id="bank_account_number"
                    name="bank_account_number"
                    type="text"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label htmlFor="bank_ifsc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">IFSC code</label>
                  <input
                    id="bank_ifsc"
                    name="bank_ifsc"
                    type="text"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
                Request withdrawal
              </button>
            </form>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No available balance to withdraw yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Withdrawal history</h2>
          {payoutRequests && payoutRequests.length > 0 ? (
            <div className="divide-y">
              {payoutRequests.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">₹{p.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Requested {new Date(p.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      p.status === 'paid'
                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                        : p.status === 'rejected'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No withdrawal requests yet.</p>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
