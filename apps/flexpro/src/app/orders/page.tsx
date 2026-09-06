import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/orders')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

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
        return <CheckCircle className="w-5 h-5 text-green-500 dark:text-green-400" />
      case 'cancelled':
      case 'refunded':
        return <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
      case 'in_progress':
        return <TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
      default:
        return <Clock className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-950/40', text: 'text-yellow-800 dark:text-yellow-400' },
      paid: { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-800 dark:text-green-400' },
      in_progress: { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-800 dark:text-blue-400' },
      delivered: { bg: 'bg-purple-100 dark:bg-purple-950/40', text: 'text-purple-800 dark:text-purple-400' },
      completed: { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-800 dark:text-green-400' },
      cancelled: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-800 dark:text-red-400' },
      refunded: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-100' },
    }

    const config = statusConfig[status] || statusConfig.pending
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  return (
    <WorkspaceShell
      activeSection="orders"
      role={profile?.role}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Orders"
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 dark:text-gray-50">My Orders</h1>

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
                  className="block bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 dark:bg-gray-900"
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
                            <p className="text-sm text-gray-600 mb-2 dark:text-gray-400">
                              Seller: {order.seller?.full_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Package: <span className="capitalize">{order.package_type}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-indigo-600 mb-2 dark:text-indigo-400">
                              ₹{order.amount?.toLocaleString()}
                            </p>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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
            <div className="bg-white rounded-lg shadow p-12 text-center dark:bg-gray-900">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4 dark:text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-50">No purchases yet</h3>
              <p className="text-gray-600 mb-6 dark:text-gray-400">Browse gigs and place your first order</p>
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
                  className="block bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 dark:bg-gray-900"
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
                            <p className="text-sm text-gray-600 mb-2 dark:text-gray-400">
                              Buyer: {order.buyer?.full_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Package: <span className="capitalize">{order.package_type}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-green-600 mb-2 dark:text-green-400">
                              ₹{order.amount?.toLocaleString()}
                            </p>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
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
            <div className="bg-white rounded-lg shadow p-12 text-center dark:bg-gray-900">
              <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4 dark:text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-50">No sales yet</h3>
              <p className="text-gray-600 dark:text-gray-400">Orders from buyers will appear here</p>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
