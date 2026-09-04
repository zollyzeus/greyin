import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, ArrowLeft, ShoppingCart, CreditCard } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/checkout/${params.id}`)
  }

  // Get gig details
  const { data: gig } = await supabase
    .from('gigs')
    .select('*, category:gig_categories(name), seller:profiles!freelancer_id(*)')
    .eq('id', params.id)
    .single()

  if (!gig) {
    redirect('/gigs')
  }

  const { data: buyerProfile } = await supabase.from('profiles').select('phone').eq('id', user.id).single()

  const basePrice = gig.price_min || 1000
  const packages = {
    basic: basePrice,
    standard: basePrice * 2,
    premium: basePrice * 3,
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/gigs/${params.id}`} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Gig</span>
          </Link>
            <ThemeToggle />
          </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-gray-50">Checkout</h1>
          <p className="text-gray-600 dark:text-gray-400">Complete your order for {gig.title}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Order Summary
              </h2>
              
              <div className="flex gap-4 pb-4 border-b">
                {gig.images?.[0] && (
                  <img
                    src={gig.images[0]}
                    alt={gig.title}
                    className="w-24 h-24 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{gig.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">by {gig.seller?.full_name || 'Seller'}</p>
                  <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{gig.category?.name}</p>
                </div>
              </div>

              {/* Package Selection */}
              <div className="mt-6 space-y-4" id="package-selection">
                <h3 className="font-semibold">Select Package</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                    <div className="flex items-center gap-3">
                      <input type="radio" name="package" value="basic" defaultChecked className="w-4 h-4 text-indigo-600 dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100" />
                      <div>
                        <p className="font-semibold">Basic Package</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Standard delivery</p>
                      </div>
                    </div>
                    <span className="font-bold text-lg">₹{packages.basic.toLocaleString()}</span>
                  </label>

                  <label className="flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                    <div className="flex items-center gap-3">
                      <input type="radio" name="package" value="standard" className="w-4 h-4 text-indigo-600 dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100" />
                      <div>
                        <p className="font-semibold">Standard Package</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Priority delivery with revisions</p>
                      </div>
                    </div>
                    <span className="font-bold text-lg">₹{packages.standard.toLocaleString()}</span>
                  </label>

                  <label className="flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer hover:border-indigo-500 transition-colors">
                    <div className="flex items-center gap-3">
                      <input type="radio" name="package" value="premium" className="w-4 h-4 text-indigo-600 dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100" />
                      <div>
                        <p className="font-semibold">Premium Package</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Express delivery with unlimited revisions</p>
                      </div>
                    </div>
                    <span className="font-bold text-lg">₹{packages.premium.toLocaleString()}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-4 dark:bg-gray-900">
              <h2 className="text-lg font-semibold mb-4">Payment Summary</h2>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Package Price</span>
                  <span className="font-semibold" id="package-price">₹{packages.basic.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Service Fee (2%)</span>
                  <span className="font-semibold" id="service-fee">₹{Math.round(packages.basic * 0.02).toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-xl text-indigo-600 dark:text-indigo-400" id="total-amount">₹{Math.round(packages.basic * 1.02).toLocaleString()}</span>
                </div>
              </div>

              <button
                id="pay-button"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                <CreditCard className="w-5 h-5" />
                Proceed to Payment
              </button>

              <p className="text-xs text-gray-500 mt-4 text-center dark:text-gray-400">
                Secure payment powered by Razorpay
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `
        const packages = ${JSON.stringify(packages)};
        const gigId = '${params.id}';
        
        // Update price on package selection
        document.querySelectorAll('input[name="package"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            const packageType = e.target.value;
            const price = packages[packageType];
            const serviceFee = Math.round(price * 0.02);
            const total = price + serviceFee;
            
            document.getElementById('package-price').textContent = '₹' + price.toLocaleString();
            document.getElementById('service-fee').textContent = '₹' + serviceFee.toLocaleString();
            document.getElementById('total-amount').textContent = '₹' + total.toLocaleString();
          });
        });

        // Payment button handler
        document.getElementById('pay-button').addEventListener('click', async () => {
          const selectedPackage = document.querySelector('input[name="package"]:checked').value;
          const price = packages[selectedPackage];
          const total = price + Math.round(price * 0.02);

          try {
            // Create order
            const response = await fetch('/api/orders/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                gigId: gigId,
                packageType: selectedPackage,
                amount: total,
              }),
            });

            const data = await response.json();

            if (!response.ok) {
              alert('Failed to create order: ' + data.error);
              return;
            }

            // Initialize Razorpay
            const options = {
              key: data.keyId,
              amount: data.amount,
              currency: data.currency,
              order_id: data.razorpayOrderId,
              name: 'FlexPro Marketplace',
              description: 'Gig Order Payment',
              handler: async function(response) {
                // Verify payment
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
              theme: {
                color: '#4F46E5',
              },
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
