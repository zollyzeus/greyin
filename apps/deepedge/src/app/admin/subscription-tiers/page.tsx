import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, ArrowLeft, Layers } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

const CREDIT_TYPES: { key: string; label: string; wired: boolean }[] = [
  { key: 'job_post', label: 'Job posts', wired: false },
  { key: 'profile_view', label: 'Candidate profile views', wired: true },
  { key: 'contact_view', label: 'Contact reveals', wired: false },
  { key: 'job_invite', label: 'Job invites', wired: false },
  { key: 'outplacement_post', label: 'Outplacement listings', wired: false },
  { key: 'placement_request', label: 'Placement requests', wired: false },
]

// Admin-configurable pricing + hiring credits for the 3 DeepEdge
// tiers (096, product='deepedge_hiring'). Mirrors FlexPro's own
// /admin/subscription-tiers exactly -- one reusable schema, one
// reusable page shape, per-product data.
//
// Only "Candidate profile views" is wired to a real enforcement point
// today (consume_credit on /candidates/[id], see that route) --
// job posting stays free by deliberate prior decision (038/039, see
// candidates/page.tsx's own comment on preserving open-board
// liquidity), and contact reveals/job invites/outplacement
// listings/placement requests aren't built as their own features yet.
// Flagged inline rather than silently priced as if live.
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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: tiers } = await supabase
    .from('subscription_tiers')
    .select('*, subscription_tier_credits ( id, credit_type, monthly_allowance )')
    .eq('product', 'deepedge_hiring')
    .order('sort_order')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Building2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin/subscriptions" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to subscriptions
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Hiring subscription tiers</h1>
        </div>
        <p className="text-sm text-gray-600 mb-6 dark:text-gray-400">
          Sets the monthly price and credit allowance per tier. Use <span className="font-mono">-1</span> for unlimited,{' '}
          <span className="font-mono">0</span> to withhold that credit type from a tier entirely. Only{' '}
          <strong>candidate profile views</strong> is enforced today; the others are priced and ready but not
          yet wired to a live action.
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
          {(tiers || []).map((tier: any) => (
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

              <div className="space-y-3 pt-2 border-t">
                {CREDIT_TYPES.map((ct) => {
                  const credit = tier.subscription_tier_credits?.find((c: any) => c.credit_type === ct.key)
                  return (
                    <label key={ct.key} className="block text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5 dark:text-gray-400">
                        {ct.label}
                        {!ct.wired && (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full dark:text-amber-400 dark:bg-amber-950/40">not yet enforced</span>
                        )}
                      </span>
                      <input
                        type="number"
                        name={`credit_${ct.key}`}
                        min="-1"
                        defaultValue={credit?.monthly_allowance ?? 0}
                        className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                    </label>
                  )
                })}
              </div>

              <button type="submit" className="w-full text-sm font-medium bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700">
                Save
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  )
}
