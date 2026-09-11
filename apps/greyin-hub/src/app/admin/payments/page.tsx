import { createClient } from '@/lib/supabase/server'
import { CreditCard } from 'lucide-react'

// New (Emergent-parity gap #1, 2026-09-08) -- Greyin has no cross-
// platform view of recent payments, unlike each pillar's own admin page
// only ever showing its own local data. Emergent also has a payment-
// gateway toggle (Stripe<->Razorpay); that half is deliberately NOT
// built here -- Stripe doesn't exist anywhere in Greyin (confirmed: no
// SDK, no env vars, no schema), Razorpay is the sole gateway across all
// 7 apps, so a toggle to a second gateway that was never integrated
// would be fake, non-functional UI.
//
// get_recent_transactions() (143) UNIONs 5 real payment sources
// (gig orders, freelancer payouts, DeepEdge + FlexPro subscriptions,
// GreyMatters tips) into one normalized, admin-gated view.
const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  gig_order: { label: 'Gig order', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  payout: { label: 'Payout', className: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' },
  subscription: { label: 'Subscription', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' },
  tip: { label: 'Tip', className: 'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400' },
}

export default async function AdminPaymentsPage() {
  const supabase = await createClient()
  const { data: transactions } = await supabase.rpc('get_recent_transactions', { p_limit: 50 })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Payments</h1>
      </div>
      <p className="text-sm text-gray-600 mb-6 dark:text-gray-400">
        The 50 most recent transactions across every pillar — gig orders, freelancer payouts, subscriptions, and tips.
      </p>

      <div className="bg-white rounded-lg shadow-md overflow-hidden dark:bg-gray-900">
        {transactions && transactions.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b dark:text-gray-400 dark:border-gray-800">
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="font-medium">Description</th>
                <th className="font-medium">Amount</th>
                <th className="font-medium">Status</th>
                <th className="font-medium px-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: any, i: number) => {
                const typeInfo = TYPE_LABELS[t.transaction_type] || { label: t.transaction_type, className: 'bg-gray-100 text-gray-700' }
                return (
                  <tr key={i} className="border-b last:border-0 dark:border-gray-800">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.className}`}>{typeInfo.label}</span>
                    </td>
                    <td>{t.description}</td>
                    <td>₹{Number(t.amount_inr).toLocaleString('en-IN')}</td>
                    <td className="capitalize">{t.status}</td>
                    <td className="px-4 text-gray-500 dark:text-gray-400">{new Date(t.occurred_at).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm p-6 dark:text-gray-400">No transactions yet.</p>
        )}
      </div>
    </div>
  )
}
