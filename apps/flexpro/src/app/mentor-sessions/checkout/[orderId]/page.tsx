import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, ArrowLeft, CreditCard } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * Trimmed-down variant of checkout/[id]/page.tsx -- no package-tier
 * selector (a single fixed price already came from book_mentor_slot's
 * pre-claimed order), otherwise identical Razorpay checkout.js wiring
 * against the existing /api/orders/create + /api/orders/verify routes.
 */
export default async function MentorSessionCheckoutPage({ params }: { params: { orderId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/mentor-sessions/checkout/${params.orderId}`)
  }

  const { data: order } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(title)')
    .eq('id', params.orderId)
    .eq('buyer_id', user.id)
    .single()

  if (!order) {
    redirect('/mentor-sessions')
  }

  if (order.status !== 'pending') {
    redirect(`/orders/${order.id}`)
  }

  const { data: buyerProfile } = await supabase.from('profiles').select('phone').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/mentor-sessions`} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to mentor sessions</span>
          </Link>
            <ThemeToggle />
          </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Confirm booking</h1>
          </div>
          <p className="text-gray-600 mb-1 dark:text-gray-400">{order.gig?.title}</p>
          <p className="text-2xl font-bold text-indigo-600 mb-6 dark:text-indigo-400">₹{order.amount.toLocaleString()}</p>

          <button
            id="pay-button"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            <CreditCard className="w-5 h-5" />
            Pay &amp; confirm
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
                gigId: '${order.gig_id}',
                packageType: 'mentor_session',
                amount: ${order.amount},
                orderId: '${order.id}',
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
              name: 'FlexPro Marketplace',
              description: 'Mentor session booking',
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
                  window.location.href = '/orders/' + data.orderId;
                } else {
                  alert('Payment verification failed');
                }
              },
              prefill: {
                email: ${JSON.stringify(user.email)},
                contact: ${JSON.stringify(buyerProfile?.phone || '')},
              },
              theme: { color: '#4F46E5' },
            };

            const razorpay = new Razorpay(options);
            razorpay.open();
          } catch (error) {
            console.error('Payment error:', error);
            alert('Payment failed. Please try again.');
          }
        });
      ` }} />
    </div>
  )
}
