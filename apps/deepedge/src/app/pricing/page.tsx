import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { CheckCircle, BadgeCheck } from 'lucide-react'

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: { role: string } | null = null
  let hasActiveSubscription = false

  if (user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    profile = data

    if (profile?.role === 'employer') {
      const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()
      if (company) {
        const { data: subscription } = await supabase
          .from('company_subscriptions')
          .select('status, current_period_end')
          .eq('company_id', company.id)
          .maybeSingle()
        hasActiveSubscription = !!subscription
          && subscription.status === 'active'
          && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())
      }
    }
  }

  const { data: plans } = await supabase.from('subscription_plans').select('*').order('tier')
  const starter = plans?.find((p) => p.tier === 'starter')
  const enterprise = plans?.find((p) => p.tier === 'enterprise')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 dark:text-gray-50">Access the Verified Expert pool</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto dark:text-gray-400">
            Posting jobs and reviewing your own applicants is always free. A subscription unlocks proactive
            search — browsing and filtering every candidate who's cleared the Verified Expert bar.
          </p>
        </div>

        {hasActiveSubscription && (
          <div className="mb-10 flex items-center gap-2 justify-center rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm font-semibold text-indigo-700 max-w-md mx-auto dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400">
            <BadgeCheck className="h-5 w-5" />
            You already have an active subscription.{' '}
            <Link href="/candidates" className="underline">Browse candidates</Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 dark:bg-gray-900 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-50">{starter?.name || 'Starter'}</h2>
            <p className="text-gray-500 mb-6 dark:text-gray-400">For a single hiring team</p>
            <p className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-gray-50">₹{starter?.price_inr?.toLocaleString() ?? '15,000'}</span>
              <span className="text-gray-500 dark:text-gray-400">/{starter?.billing_cycle === 'annual' ? 'year' : 'month'}</span>
            </p>
            <ul className="space-y-3 mb-8 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0 dark:text-indigo-400" /> Full Verified Expert candidate search</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0 dark:text-indigo-400" /> Cancel any time, billed monthly</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0 dark:text-indigo-400" /> Self-serve online activation</li>
            </ul>
            {!user ? (
              <Link href="/signup?type=employer" className="block text-center bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
                Sign up to subscribe
              </Link>
            ) : profile?.role !== 'employer' ? (
              <p className="text-sm text-gray-500 text-center dark:text-gray-400">Subscriptions are for employer accounts.</p>
            ) : hasActiveSubscription ? (
              <Link href="/candidates" className="block text-center bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-semibold dark:bg-gray-800 dark:text-gray-300">
                Already subscribed
              </Link>
            ) : (
              <Link href="/subscribe" className="block text-center bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
                Subscribe
              </Link>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md border-2 border-indigo-600 p-8 dark:bg-gray-900">
            <h2 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-50">{enterprise?.name || 'Enterprise'}</h2>
            <p className="text-gray-500 mb-6 dark:text-gray-400">For multi-seat teams and custom terms</p>
            <p className="mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-gray-50">Custom</span>
            </p>
            <ul className="space-y-3 mb-8 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0 dark:text-indigo-400" /> Everything in Starter</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0 dark:text-indigo-400" /> Multi-seat access, dedicated support</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0 dark:text-indigo-400" /> Billed by invoice, not by card</li>
            </ul>
            {!user ? (
              <Link href="/signup?type=employer" className="block text-center border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40">
                Sign up to contact sales
              </Link>
            ) : profile?.role !== 'employer' ? (
              <p className="text-sm text-gray-500 text-center dark:text-gray-400">Subscriptions are for employer accounts.</p>
            ) : (
              <Link href="/enterprise-contact" className="block text-center border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40">
                Contact Sales
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
