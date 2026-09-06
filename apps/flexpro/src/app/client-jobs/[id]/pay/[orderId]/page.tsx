import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

// The job-engagement equivalent of /checkout/[id] -- no package
// selection (the accepted application already fixed a single price),
// just completing payment on an order api/client-jobs/.../accept
// already pre-claimed.
export default async function ClientJobPayPage({ params }: { params: Promise<{ id: string; orderId: string }> }) {
  const { id: jobId, orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/client-jobs/${jobId}/pay/${orderId}`)
  }

  const { data: order } = await supabase
    .from('gig_orders')
    .select('id, amount, service_fee_buyer, buyer_id, razorpay_order_id, seller:profiles!seller_id(full_name)')
    .eq('id', orderId)
    .single()

  if (!order || order.buyer_id !== user.id) {
    redirect(`/client-jobs/${jobId}`)
  }

  const { data: buyerProfile } = await supabase.from('profiles').select('full_name, role, phone').eq('id', user.id).single()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const total = order.amount + order.service_fee_buyer

  return (
    <WorkspaceShell
      role={buyerProfile?.role}
      userName={buyerProfile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Complete Payment"
    >
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 dark:text-gray-50">Complete payment</h1>
          <p className="text-gray-600 mb-6 dark:text-gray-400">
            You accepted {(order as any).seller?.full_name || 'this freelancer'}&rsquo;s application. Payment is held
            in escrow until they deliver and you accept.
          </p>

          <div className="space-y-2 mb-6 border-t border-b py-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Agreed price</span>
              <span className="font-semibold">₹{order.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Service fee</span>
              <span className="font-semibold">₹{order.service_fee_buyer.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-bold">Total</span>
              <span className="font-bold text-xl text-orange-600 dark:text-orange-400">₹{total.toLocaleString()}</span>
            </div>
          </div>

          <button
            id="pay-button"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
          >
            <CreditCard className="w-5 h-5" />
            Proceed to Payment
          </button>

          <p className="text-xs text-gray-500 mt-4 text-center dark:text-gray-400">Secure payment powered by Razorpay</p>
        </div>
      </div>

      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('pay-button').addEventListener('click', async () => {
          try {
            const response = await fetch('/api/orders/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: ${JSON.stringify(orderId)},
                clientJobEngagement: true,
              }),
            });
            const data = await response.json();
            if (!response.ok) {
              alert('Failed to start payment: ' + data.error);
              return;
            }

            const options = {
              key: data.keyId,
              amount: data.amount,
              currency: data.currency,
              order_id: data.razorpayOrderId,
              name: 'FlexPro',
              description: 'Job Engagement Payment',
              handler: async function(response) {
                const verifyResponse = await fetch('/api/orders/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: data.orderId,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpaySignature: response.razorpay_signature,
                  }),
                });
                if (verifyResponse.ok) {
                  window.location.href = '/orders/' + data.orderId + '/success';
                } else {
                  alert('Payment verification failed');
                }
              },
              prefill: {
                email: ${JSON.stringify(user.email)},
                contact: ${JSON.stringify(buyerProfile?.phone || '')},
              },
              theme: { color: '#EA580C' },
            };

            const razorpay = new Razorpay(options);
            razorpay.open();
          } catch (error) {
            console.error('Payment error:', error);
            alert('Payment failed. Please try again.');
          }
        });
      ` }} />
    </WorkspaceShell>
  )
}
