import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Download, MessageSquare, Package } from 'lucide-react'

export default async function OrderSuccessPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/orders/${params.id}/success`)
  }

  // Get order details
  const { data: order } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(*, category:gig_categories(name)), seller:profiles!seller_id(*)')
    .eq('id', params.id)
    .eq('buyer_id', user.id)
    .single()

  if (!order) {
    redirect('/orders')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600">Your order has been placed successfully</p>
          </div>

          <div className="border-t border-b py-6 my-6 text-left">
            <h2 className="text-lg font-semibold mb-4">Order Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID</span>
                <span className="font-mono text-sm">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Gig</span>
                <span className="font-semibold">{order.gig?.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Package</span>
                <span className="capitalize">{order.package_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-bold text-lg text-indigo-600">₹{order.amount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Seller</span>
                <span>{order.seller?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  In Progress
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-left mb-3">Next Steps</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">1.</span>
                  <span>The seller has been notified and will start working on your order</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">2.</span>
                  <span>You can communicate with the seller through the order chat</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">3.</span>
                  <span>Track your order progress in the Orders section</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">4.</span>
                  <span>You'll receive a notification when the order is delivered</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <Link
              href={`/orders/${order.id}`}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              <Package className="w-5 h-5" />
              View Order
            </Link>
            <Link
              href="/orders"
              className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 font-medium"
            >
              All Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
