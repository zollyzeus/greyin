import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Layers } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

// Admin-configurable pricing + posting credits for the 3 FlexPro
// posting tiers (096, product='flexpro_posting'). Same
// form-per-row/server-action convention as every other /admin page
// in this app -- RLS's own "Admins manage subscription tiers" policy
// is the real enforcement, this page's own role check just avoids a
// confusing silent-failure UI for a non-admin.
export default async function SubscriptionTiersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/subscription-tiers')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: tiers } = await supabase
    .from('subscription_tiers')
    .select('*, subscription_tier_credits ( id, credit_type, monthly_allowance )')
    .eq('product', 'flexpro_posting')
    .order('sort_order')

  return (
    <WorkspaceShell
      activeSection="admin"
      role={profile?.role}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Posting Subscription Tiers"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Posting subscription tiers</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6 dark:text-gray-400">
          Sets the monthly price and gig/job posting credit allowance for each tier. A subscriber can post
          this many gigs or client jobs (combined) per billing month; use <span className="font-mono">-1</span> for unlimited.
        </p>

        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Tier updated.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {(tiers || []).map((tier: any) => {
            const gigCredit = tier.subscription_tier_credits?.find((c: any) => c.credit_type === 'gig_post')
            return (
              <form
                key={tier.id}
                action="/api/admin/subscription-tiers/update"
                method="POST"
                className="bg-white rounded-lg shadow-md p-5 space-y-4 dark:bg-gray-900"
              >
                <input type="hidden" name="tier_id" value={tier.id} />
                <input type="hidden" name="return_to" value="/admin/subscription-tiers" />
                <h2 className="font-semibold text-gray-900 dark:text-gray-50">{tier.name} <span className="text-xs text-gray-400 font-normal dark:text-gray-500">({tier.tier_key})</span></h2>

                <label className="block text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Price (₹/mo)</span>
                  <input
                    type="number"
                    name="price_inr"
                    min="0"
                    defaultValue={tier.price_inr}
                    className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </label>

                <label className="block text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Gig/job posting credits per month</span>
                  <input
                    type="number"
                    name="gig_post_allowance"
                    min="-1"
                    defaultValue={gigCredit?.monthly_allowance ?? 0}
                    className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </label>

                <button type="submit" className="w-full text-sm font-medium bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700">
                  Save
                </button>
              </form>
            )
          })}
        </div>
      </div>
    </WorkspaceShell>
  )
}
