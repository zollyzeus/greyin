import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft, Wallet } from 'lucide-react'

const PLATFORM_FEE_RATE = 0.02

export default async function EarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/earnings')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_mentor')
    .eq('id', user.id)
    .single()

  // Mentors can earn from bookable session gigs (056_mentor_sessions.sql)
  // regardless of role='freelancer' -- their income flows through this
  // same payout_requests/gig_orders machinery, so they need to be able
  // to see and withdraw it.
  if (profile?.role !== 'freelancer' && !profile?.is_mentor) {
    redirect('/dashboard')
  }

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
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">FlexPro</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Wallet className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center mb-2">
            <div>
              <p className="text-sm text-gray-500">Total earned</p>
              <p className="text-xl font-bold" id="total-earned">₹{netEarned.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Already requested</p>
              <p className="text-xl font-bold" id="already-claimed">₹{alreadyClaimed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Available balance</p>
              <p className="text-xl font-bold text-green-600" id="available-balance">₹{available.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Earnings shown after the platform&apos;s {PLATFORM_FEE_RATE * 100}% service fee. Based on completed orders only.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-lg font-semibold mb-4">Request a withdrawal</h2>
          {available > 0 ? (
            <form action="/api/payouts/request" method="POST" className="space-y-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount (₹)</label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min={1}
                  max={available}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Up to ₹${available.toLocaleString()}`}
                />
              </div>
              <div>
                <label htmlFor="bank_account_name" className="block text-sm font-medium text-gray-700">Account holder name</label>
                <input
                  id="bank_account_name"
                  name="bank_account_name"
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bank_account_number" className="block text-sm font-medium text-gray-700">Account number</label>
                  <input
                    id="bank_account_number"
                    name="bank_account_number"
                    type="text"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="bank_ifsc" className="block text-sm font-medium text-gray-700">IFSC code</label>
                  <input
                    id="bank_ifsc"
                    name="bank_ifsc"
                    type="text"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
                Request withdrawal
              </button>
            </form>
          ) : (
            <p className="text-gray-500 text-sm">No available balance to withdraw yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-lg font-semibold mb-4">Withdrawal history</h2>
          {payoutRequests && payoutRequests.length > 0 ? (
            <div className="divide-y">
              {payoutRequests.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">₹{p.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">
                      Requested {new Date(p.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      p.status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : p.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No withdrawal requests yet.</p>
          )}
        </div>
      </div>
    </main>
  )
}
