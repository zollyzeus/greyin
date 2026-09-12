import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, Check } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

const CREDIT_LABELS: Record<string, string> = {
  job_post: 'job posts',
  profile_view: 'candidate profile views',
  contact_view: 'contact reveals',
  job_invite: 'job invites',
  outplacement_post: 'outplacement listings',
  placement_request: 'placement requests',
}

// 096 replaced the single fixed 'starter' plan with 3 admin-priced,
// admin-credited hiring tiers (subscription_tiers,
// product='deepedge_hiring') -- this page now picks one instead of
// showing a single subscribe button. Enterprise stays sales-led,
// reached via /enterprise-contact, not sold here.
export default async function SubscribePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/subscribe')
  }

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'employer') {
    redirect('/dashboard')
  }

  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: tiers } = await supabase
    .from('subscription_tiers')
    .select('*, subscription_tier_credits ( credit_type, monthly_allowance )')
    .eq('product', 'deepedge_hiring')
    .eq('active', true)
    .order('sort_order')

  return (
    <WorkspaceShell
      variant="employer"
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle="Subscribe"
    >
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/pricing" className="flex items-center gap-2 mb-6 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Pricing</span>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center dark:text-gray-50">Subscribe to search the Verified Expert pool</h1>
        <p className="text-gray-600 mb-8 text-center max-w-xl mx-auto dark:text-gray-400">
          Reviewing applicants to your own job postings stays free. Choose a tier for proactive candidate
          search and its monthly allowances below.
        </p>

        <div className="grid sm:grid-cols-3 gap-6">
          {(tiers || []).map((tier: any) => {
            const credits: any[] = tier.subscription_tier_credits || []
            const isPro = tier.tier_key === 'pro'
            return (
              <div
                key={tier.id}
                className={`bg-white dark:bg-gray-900 rounded-lg shadow p-6 border-2 flex flex-col ${isPro ? 'border-indigo-500' : 'border-transparent'}`}
              >
                {isPro && (
                  <span className="self-start mb-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full dark:text-indigo-400 dark:bg-indigo-950/40">
                    Most popular
                  </span>
                )}
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">{tier.name}</h2>
                <div className="my-3">
                  <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">₹{tier.price_inr.toLocaleString()}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
                </div>
                <ul className="space-y-1.5 mb-6">
                  {credits
                    .filter((c) => c.monthly_allowance !== 0)
                    .map((c) => (
                      <li key={c.credit_type} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-600 shrink-0 dark:text-green-400" />
                        {c.monthly_allowance === -1 ? 'Unlimited' : c.monthly_allowance} {CREDIT_LABELS[c.credit_type] || c.credit_type}
                      </li>
                    ))}
                </ul>
                <button
                  data-tier-key={tier.tier_key}
                  className="subscribe-button mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  Choose {tier.name}
                </button>
              </div>
            )
          })}
        </div>

        <div id="subscribe-error" hidden className="max-w-md mx-auto rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mt-6 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400"></div>

        <p className="text-xs text-gray-500 mt-6 text-center dark:text-gray-400">
          Secure payment powered by Razorpay. Cancel any time.{' '}
          <Link href="/enterprise-contact" className="text-indigo-600 hover:underline dark:text-indigo-400">Need Enterprise volume?</Link>
        </p>
      </div>

      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelectorAll('.subscribe-button').forEach(function(subscribeButton) {
          function showSubscribeError(msg) {
            const el = document.getElementById('subscribe-error');
            el.textContent = msg;
            el.hidden = false;
          }

          subscribeButton.addEventListener('click', async () => {
            document.getElementById('subscribe-error').hidden = true;
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
                showSubscribeError('Failed to start subscription: ' + (data.error || 'Please try again.'));
                button.disabled = false;
                button.textContent = originalText;
                return;
              }

              const options = {
                key: data.keyId,
                subscription_id: data.subscriptionId,
                name: 'DeepEdge',
                description: 'Hiring Subscription',
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
                    window.location.href = '/candidates?subscribed=1';
                  } else {
                    showSubscribeError('Payment succeeded but activation is still confirming -- this can take a minute. Refresh /candidates shortly.');
                  }
                },
                prefill: {
                  email: ${JSON.stringify(user.email)},
                },
                theme: {
                  color: '#4F46E5',
                },
              };

              const razorpay = new Razorpay(options);
              razorpay.open();
              button.disabled = false;
              button.textContent = originalText;
            } catch (error) {
              console.error('Subscription error:', error);
              showSubscribeError('Something went wrong. Please try again.');
              button.disabled = false;
              button.textContent = originalText;
            }
          });
        });
      ` }} />
    </WorkspaceShell>
  )
}
