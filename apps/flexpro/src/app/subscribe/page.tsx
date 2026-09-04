import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, Check } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

// Mirrors deepedge's own /subscribe (039) -- open to any authenticated
// user, not gated to a role, since FreeAgent has no employer/candidate
// split: the same subscription unlocks posting a gig as a freelancer
// and posting a job as a client (093).
//
// 096 replaced the single fixed 'flexpro_pro' plan with 3 admin-priced
// tiers (subscription_tiers, product='flexpro_posting'), each carrying
// a monthly gig/job-posting credit allowance (subscription_tier_credits,
// credit_type='gig_post', -1 = unlimited) -- this page now picks one.
export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/subscribe')
  }

  const { data: existing } = await supabase
    .from('flexpro_subscriptions')
    .select('status, tier_id, subscription_tiers ( name )')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: tiers } = await supabase
    .from('subscription_tiers')
    .select('*, subscription_tier_credits ( credit_type, monthly_allowance )')
    .eq('product', 'flexpro_posting')
    .eq('active', true)
    .order('sort_order')

  const existingTierName = (existing as any)?.subscription_tiers?.name
  // An active subscriber can still land here with an error -- out of
  // posting credits for the month. Show the tier picker (so they can
  // upgrade) instead of the "you're already subscribed" dead-end.
  const showTierPicker = existing?.status !== 'active' || !!error

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to FlexPro</span>
          </Link>
            <ThemeToggle />
          </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center dark:text-gray-50">Subscribe to post on FlexPro</h1>
        <p className="text-gray-600 mb-8 text-center max-w-xl mx-auto dark:text-gray-400">
          Unlocks posting a gig listing as a freelancer and posting a job as a client. Applying to jobs
          and buying gigs stay free. A modest service fee applies to both sides once a transaction is
          accepted.
        </p>

        {error && (
          <div className="max-w-md mx-auto rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-6 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400">
            {decodeURIComponent(error)}
          </div>
        )}

        {!showTierPicker ? (
          <div className="max-w-md mx-auto rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            You already have an active {existingTierName || ''} subscription.
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-6">
              {(tiers || []).map((tier: any) => {
                const gigCredit = tier.subscription_tier_credits?.find((c: any) => c.credit_type === 'gig_post')
                const allowanceLabel = gigCredit
                  ? gigCredit.monthly_allowance === -1
                    ? 'Unlimited posts/mo'
                    : `${gigCredit.monthly_allowance} posts/mo`
                  : null
                const isPro = tier.tier_key === 'pro'
                return (
                  <div
                    key={tier.id}
                    className={`bg-white rounded-lg shadow p-6 border-2 flex flex-col ${isPro ? 'border-orange-500' : 'border-transparent'}`}
                  >
                    {isPro && (
                      <span className="self-start mb-2 text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full dark:text-orange-400 dark:bg-orange-950/40">
                        Most popular
                      </span>
                    )}
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">{tier.name}</h2>
                    <div className="my-3">
                      <span className="text-3xl font-bold text-orange-600 dark:text-orange-400">₹{tier.price_inr.toLocaleString()}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
                    </div>
                    {allowanceLabel && (
                      <p className="flex items-center gap-2 text-sm text-gray-700 mb-6 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-600 shrink-0 dark:text-green-400" />
                        {allowanceLabel}
                      </p>
                    )}
                    <button
                      data-tier-key={tier.tier_key}
                      className="subscribe-button mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm"
                    >
                      <CreditCard className="w-4 h-4" />
                      Choose {tier.name}
                    </button>
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-gray-500 mt-6 text-center dark:text-gray-400">
              Secure payment powered by Razorpay. Cancel any time.
            </p>
          </>
        )}
      </div>

      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelectorAll('.subscribe-button').forEach(function(subscribeButton) {
          subscribeButton.addEventListener('click', async () => {
            const button = subscribeButton;
            const tierKey = button.getAttribute('data-tier-key');
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = 'Preparing checkout...';
            try {
              const response = await fetch('/api/subscriptions/checkout/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tierKey: tierKey }),
              });
              const data = await response.json();

              if (!response.ok) {
                alert('Failed to start subscription: ' + data.error);
                button.disabled = false;
                button.textContent = originalText;
                return;
              }

              const options = {
                key: data.keyId,
                subscription_id: data.subscriptionId,
                name: 'FlexPro',
                description: 'FlexPro Subscription',
                recurring: 1,
                handler: async function(response) {
                  const verifyResponse = await fetch('/api/subscriptions/checkout/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      razorpaySubscriptionId: response.razorpay_subscription_id,
                      razorpayPaymentId: response.razorpay_payment_id,
                      razorpaySignature: response.razorpay_signature,
                    }),
                  });

                  if (verifyResponse.ok) {
                    window.location.href = '/gigs/new?subscribed=1';
                  } else {
                    alert('Payment succeeded but activation is still confirming -- this can take a minute.');
                  }
                },
                prefill: {
                  email: ${JSON.stringify(user.email)},
                },
                theme: {
                  color: '#EA580C',
                },
              };

              const razorpay = new Razorpay(options);
              razorpay.open();
              button.disabled = false;
              button.textContent = originalText;
            } catch (error) {
              console.error('Subscription error:', error);
              alert('Something went wrong. Please try again.');
              button.disabled = false;
              button.textContent = originalText;
            }
          });
        });
      ` }} />
    </div>
  )
}
