import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/orders')
  }

  // Get all orders for the user (both as buyer and seller)
  const { data: buyerOrders } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(title, images), seller:profiles!seller_id(full_name)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  const { data: sellerOrders } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(title, images), buyer:profiles!buyer_id(full_name)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'cancelled':
      case 'refunded':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'in_progress':
        return <TrendingUp className="w-5 h-5 text-blue-500" />
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      paid: { bg: 'bg-green-100', text: 'text-green-800' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800' },
      delivered: { bg: 'bg-purple-100', text: 'text-purple-800' },
      completed: { bg: 'bg-green-100', text: 'text-green-800' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800' },
      refunded: { bg: 'bg-gray-100', text: 'text-gray-800' },
    }

    const config = statusConfig[status] || statusConfig.pending
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>

        {/* Purchases */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Package className="w-6 h-6" />
            Purchases ({buyerOrders?.length || 0})
          </h2>

          {buyerOrders && buyerOrders.length > 0 ? (
            <div className="space-y-4">
              {buyerOrders.map((order: any) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4 flex-1">
                      {order.gig?.images?.[0] && (
                        <img
                          src={order.gig.images[0]}
                          alt={order.gig.title}
                          className="w-24 h-24 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg mb-1">{order.gig?.title}</h3>
                            <p className="text-sm text-gray-600 mb-2">
                              Seller: {order.seller?.full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Package: <span className="capitalize">{order.package_type}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-indigo-600 mb-2">
                              ₹{order.amount?.toLocaleString()}
                            </p>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                          <span>Ordered: {new Date(order.created_at).toLocaleDateString()}</span>
                          {order.delivered_at && (
                            <span>Delivered: {new Date(order.delivered_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No purchases yet</h3>
              <p className="text-gray-600 mb-6">Browse gigs and place your first order</p>
              <Link
                href="/gigs"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Browse Gigs
              </Link>
            </div>
          )}
        </div>

        {/* Sales */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Sales ({sellerOrders?.length || 0})
          </h2>

          {sellerOrders && sellerOrders.length > 0 ? (
            <div className="space-y-4">
              {sellerOrders.map((order: any) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4 flex-1">
                      {order.gig?.images?.[0] && (
                        <img
                          src={order.gig.images[0]}
                          alt={order.gig.title}
                          className="w-24 h-24 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg mb-1">{order.gig?.title}</h3>
                            <p className="text-sm text-gray-600 mb-2">
                              Buyer: {order.buyer?.full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Package: <span className="capitalize">{order.package_type}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-green-600 mb-2">
                              ₹{order.amount?.toLocaleString()}
                            </p>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                          <span>Ordered: {new Date(order.created_at).toLocaleDateString()}</span>
                          {order.delivered_at && (
                            <span>Delivered: {new Date(order.delivered_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No sales yet</h3>
              <p className="text-gray-600">Orders from buyers will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
