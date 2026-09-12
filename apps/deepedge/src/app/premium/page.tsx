import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, Check } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

// Candidate-side counterpart to /subscribe (which sells the 3 employer
// hiring tiers) -- one tier only, product='deepedge_candidate' (150).
// Unlocks seeing WHO viewed your profile; the weekly count itself
// already shows for free on /dashboard.
export default async function PremiumPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/premium')
  }

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role === 'employer') {
    redirect('/dashboard')
  }

  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: tier } = await supabase
    .from('subscription_tiers')
    .select('*')
    .eq('product', 'deepedge_candidate')
    .eq('tier_key', 'premium')
    .eq('active', true)
    .maybeSingle()

  const { data: existing } = await supabase
    .from('candidate_subscriptions')
    .select('status, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle()
  const alreadyActive = existing?.status === 'active' && (!existing.current_period_end || new Date(existing.current_period_end) > new Date())

  return (
    <WorkspaceShell
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Profile Insights"
    >
      <div className="max-w-md mx-auto px-4 py-12">
        <Link href="/dashboard" className="flex items-center gap-2 mb-6 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center dark:text-gray-50">Profile Insights</h1>
        <p className="text-gray-600 mb-8 text-center dark:text-gray-400">
          See exactly which employers viewed your profile, not just how many.
        </p>

        {alreadyActive ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 text-center border-2 border-green-500">
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">You already have Profile Insights active.</p>
            <Link href="/dashboard" className="inline-block mt-4 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">View your dashboard</Link>
          </div>
        ) : tier ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border-2 border-indigo-500 flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">{tier.name}</h2>
            <div className="my-3">
              <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">₹{tier.price_inr.toLocaleString()}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>
            </div>
            <ul className="space-y-1.5 mb-6">
              <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Check className="w-4 h-4 text-green-600 shrink-0 dark:text-green-400" />
                See which employers viewed your profile
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Check className="w-4 h-4 text-green-600 shrink-0 dark:text-green-400" />
                Weekly view count stays free either way
              </li>
            </ul>
            <button
              data-tier-key="premium"
              className="subscribe-button mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
            >
              <CreditCard className="w-4 h-4" />
              Subscribe
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center dark:text-gray-400">Profile Insights isn't available right now.</p>
        )}

        <div id="subscribe-error" hidden className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mt-6 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-400"></div>

        <p className="text-xs text-gray-500 mt-6 text-center dark:text-gray-400">
          Secure payment powered by Razorpay. Cancel any time.
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
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = 'Preparing checkout...';
            try {
              const response = await fetch('/api/candidate-subscriptions/checkout/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                description: 'Profile Insights',
                recurring: 1,
                handler: async function(response) {
                  const verifyResponse = await fetch('/api/candidate-subscriptions/checkout/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      razorpaySubscriptionId: response.razorpay_subscription_id,
                      razorpayPaymentId: response.razorpay_payment_id,
                      razorpaySignature: response.razorpay_signature,
                    }),
                  });

                  if (verifyResponse.ok) {
                    window.location.href = '/dashboard?insights=1';
                  } else {
                    showSubscribeError('Payment succeeded but activation is still confirming -- this can take a minute. Refresh your dashboard shortly.');
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
