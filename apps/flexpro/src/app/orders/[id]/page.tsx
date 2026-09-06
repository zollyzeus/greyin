import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Package, Clock, CheckCircle, MessageSquare, Download, AlertCircle } from 'lucide-react'
import OrderChat from '@/components/OrderChat'
import OrderReview from '@/components/OrderReview'
import SkillRatingForm from '@/components/SkillRatingForm'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/orders/${params.id}`)
  }

  const { data: viewerProfile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: viewerScoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  // Get order details
  const { data: order } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(*, category:gig_categories(name)), seller:profiles!seller_id(*), buyer:profiles!buyer_id(*)')
    .eq('id', params.id)
    .single()

  if (!order || (order.buyer_id !== user.id && order.seller_id !== user.id)) {
    redirect('/orders')
  }

  // AI-rated delivery quality (048_ai_quality_scores.sql) -- written
  // right after the buyer's review is submitted, additive/informational
  // only (does not feed greyin_score, unlike GreyMatters' post score).
  const { data: qualityScore } = await supabase
    .from('ai_quality_scores')
    .select('score, notes')
    .eq('gig_order_id', order.id)
    .eq('content_type', 'flexpro_delivery')
    .maybeSingle()

  const isSeller = order.seller_id === user.id
  const isBuyer = order.buyer_id === user.id
  const otherParty = isSeller ? order.buyer : order.seller

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { icon: any; color: string; text: string }> = {
      pending: { icon: Clock, color: 'text-yellow-600 dark:text-yellow-400', text: 'Payment Pending' },
      paid: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', text: 'Payment Received' },
      in_progress: { icon: Package, color: 'text-blue-600 dark:text-blue-400', text: 'In Progress' },
      delivered: { icon: CheckCircle, color: 'text-purple-600 dark:text-purple-400', text: 'Delivered' },
      revision_requested: { icon: AlertCircle, color: 'text-orange-600 dark:text-orange-400', text: 'Revision Requested' },
      disputed: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', text: 'Disputed — Under Review' },
      completed: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', text: 'Completed' },
      cancelled: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', text: 'Cancelled' },
      refunded: { icon: AlertCircle, color: 'text-gray-600 dark:text-gray-400', text: 'Refunded' },
    }
    return statusConfig[status] || statusConfig.pending
  }

  const statusInfo = getStatusInfo(order.status)
  const StatusIcon = statusInfo.icon

  return (
    <WorkspaceShell
      activeSection="orders"
      role={viewerProfile?.role}
      userName={viewerProfile?.full_name || 'User'}
      verified={!!viewerScoreRow?.is_verified_expert}
      greyinScore={viewerScoreRow?.greyin_score ?? null}
      pageTitle="Order Detail"
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Order Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2 dark:text-gray-50">Order #{order.id.slice(0, 8)}</h1>
              <p className="text-gray-600 dark:text-gray-400">Placed on {new Date(order.created_at).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-2 mb-2 ${statusInfo.color}`}>
                <StatusIcon className="w-5 h-5" />
                <span className="font-semibold">{statusInfo.text}</span>
              </div>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">₹{order.amount?.toLocaleString()}</p>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-between items-center">
              <div className={`flex items-center gap-2 ${order.status !== 'pending' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${order.status !== 'pending' ? 'bg-green-100 dark:bg-green-950/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">Paid</span>
              </div>
              <div className={`flex-1 h-1 mx-4 ${order.status === 'in_progress' || order.status === 'delivered' || order.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`flex items-center gap-2 ${order.status === 'in_progress' || order.status === 'delivered' || order.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${order.status === 'in_progress' || order.status === 'delivered' || order.status === 'completed' ? 'bg-green-100 dark:bg-green-950/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <Package className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">In Progress</span>
              </div>
              <div className={`flex-1 h-1 mx-4 ${order.status === 'delivered' || order.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
              <div className={`flex items-center gap-2 ${order.status === 'delivered' || order.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${order.status === 'delivered' || order.status === 'completed' ? 'bg-green-100 dark:bg-green-950/40' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <Download className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">Delivered</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Gig Info */}
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <h2 className="text-lg font-semibold mb-4">Gig Details</h2>
              <div className="flex gap-4">
                {order.gig?.images?.[0] && (
                  <img
                    src={order.gig.images[0]}
                    alt={order.gig.title}
                    className="w-32 h-32 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{order.gig?.title}</h3>
                  <p className="text-sm text-gray-600 mb-2 dark:text-gray-400">{order.gig?.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="bg-gray-100 px-2 py-1 rounded dark:bg-gray-800">{order.gig?.category?.name}</span>
                    <span className="capitalize">Package: {order.package_type}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deliverables */}
            {order.deliverables && order.deliverables.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Deliverables
                </h2>
                <div className="space-y-3">
                  {order.deliverables.map((file: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-gray-950">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Download className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                          <div>
                            <span className="text-sm font-medium block">{file.name}</span>
                            {file.notes && (
                              <span className="text-xs text-gray-500 block mt-1 dark:text-gray-400">{file.notes}</span>
                            )}
                            {file.uploaded_at && (
                              <span className="text-xs text-gray-400 block mt-1 dark:text-gray-500">
                                Uploaded: {new Date(file.uploaded_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <a
                        href={file.url}
                        download
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium ml-4 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Chat/Messages */}
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Order Communication
              </h2>
              <p className="text-gray-600 text-sm mb-4 dark:text-gray-400">
                Communicate with {isSeller ? 'the buyer' : 'the seller'} about this order
              </p>
              <OrderChat orderId={order.id} currentUserId={user.id} />
            </div>

            {/* Order Review */}
            {order.status === 'completed' && (
              <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  {isBuyer ? 'Leave a Review' : 'Customer Review'}
                </h2>
                <OrderReview
                  orderId={order.id}
                  isBuyer={isBuyer}
                  isSeller={isSeller}
                  orderStatus={order.status}
                />
                {qualityScore && (
                  <p className="text-sm text-gray-600 mt-4 pt-4 border-t dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-gray-50">AI delivery review: {qualityScore.score}/100</span>
                    {qualityScore.notes ? ` — ${qualityScore.notes}` : ''}
                  </p>
                )}
                {isBuyer && order.gig?.tags?.length > 0 && (
                  <SkillRatingForm orderId={order.id} rateeId={order.seller_id} skills={order.gig.tags} />
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Party Info */}
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <h2 className="text-lg font-semibold mb-4">{isSeller ? 'Buyer' : 'Seller'} Info</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                  <p className="font-semibold">{otherParty?.full_name}</p>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <h2 className="text-lg font-semibold mb-4">Payment Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Package Price</span>
                  <span className="font-semibold">₹{Math.round(order.amount / 1.02).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Service Fee</span>
                  <span className="font-semibold">₹{Math.round(order.amount * 0.02).toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">₹{order.amount?.toLocaleString()}</span>
                </div>
                {order.razorpay_payment_id && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Payment ID</p>
                    <p className="text-xs font-mono break-all">{order.razorpay_payment_id}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {isSeller && order.status === 'paid' && (
              <form action="/api/orders/update-status" method="POST">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="status" value="in_progress" />
                <button 
                  type="submit"
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Mark as In Progress
                </button>
              </form>
            )}
            {isSeller && (order.status === 'in_progress' || order.status === 'revision_requested') && (
              <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <h3 className="font-semibold mb-4">Upload Deliverable</h3>
                {order.status === 'revision_requested' && order.revision_notes && (
                  <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 dark:bg-orange-950/40 dark:border-orange-900 dark:text-orange-400">
                    <p className="font-medium mb-1">Buyer requested changes:</p>
                    <p>{order.revision_notes}</p>
                  </div>
                )}
                <form action="/api/orders/upload-deliverable" method="POST" encType="multipart/form-data">
                  <input type="hidden" name="orderId" value={order.id} />
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                        File *
                      </label>
                      <input 
                        type="file" 
                        name="file" 
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                        Notes (optional)
                      </label>
                      <textarea 
                        name="notes" 
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        placeholder="Add any notes about the deliverable..."
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                    >
                      Upload & Mark Delivered
                    </button>
                  </div>
                </form>
                {order.status === 'revision_requested' && (
                  <details className="mt-4">
                    <summary className="text-sm font-medium text-red-600 cursor-pointer dark:text-red-400">Dispute this revision request instead</summary>
                    <form action="/api/orders/dispute" method="POST" className="mt-3 space-y-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <textarea
                        name="reason"
                        required
                        rows={3}
                        placeholder="Explain the issue — an admin will review and decide whether the revision request is reasonable."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                      <button type="submit" className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                        Escalate to admin
                      </button>
                    </form>
                  </details>
                )}
              </div>
            )}
            {/* Was buyer-only before 092/093's dispute fix -- a seller
                who's delivered and is just waiting had no equivalent to
                the buyer's own "waiting, or dispute instead" block below. */}
            {isSeller && order.status === 'delivered' && (
              <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <p className="text-sm text-gray-600 dark:text-gray-400">Waiting for the buyer to accept or request changes.</p>
                <details className="mt-4">
                  <summary className="text-sm font-medium text-red-600 cursor-pointer dark:text-red-400">Raise a dispute</summary>
                  <form action="/api/orders/dispute" method="POST" className="mt-3 space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <textarea
                      name="reason"
                      required
                      rows={3}
                      placeholder="Explain the issue — an admin will review and decide whether to release payment or refund the buyer."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <button type="submit" className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                      Escalate to admin
                    </button>
                  </form>
                </details>
              </div>
            )}
            {isBuyer && order.status === 'delivered' && (
              <div className="bg-white rounded-lg shadow p-6 space-y-4 dark:bg-gray-900">
                <form action="/api/orders/update-status" method="POST">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="status" value="completed" />
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Accept Delivery
                  </button>
                </form>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Accepting releases payment to the freelancer. Not satisfied? Request changes or raise a dispute instead.
                </p>
                <details>
                  <summary className="text-sm font-medium text-orange-600 cursor-pointer dark:text-orange-400">Request changes</summary>
                  <form action="/api/orders/request-revision" method="POST" className="mt-3 space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <textarea
                      name="notes"
                      required
                      rows={3}
                      placeholder="What needs to change?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <button type="submit" className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium">
                      Send back for revision
                    </button>
                  </form>
                </details>
                <details>
                  <summary className="text-sm font-medium text-red-600 cursor-pointer dark:text-red-400">Raise a dispute</summary>
                  <form action="/api/orders/dispute" method="POST" className="mt-3 space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <textarea
                      name="reason"
                      required
                      rows={3}
                      placeholder="Explain the issue — an admin will review and decide whether to release payment or refund you."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <button type="submit" className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                      Escalate to admin
                    </button>
                  </form>
                </details>
              </div>
            )}
            {isBuyer && order.status === 'revision_requested' && (
              <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <p className="text-sm text-gray-600 dark:text-gray-400">Waiting for the freelancer to address your feedback.</p>
                <details className="mt-4">
                  <summary className="text-sm font-medium text-red-600 cursor-pointer dark:text-red-400">Raise a dispute instead</summary>
                  <form action="/api/orders/dispute" method="POST" className="mt-3 space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <textarea
                      name="reason"
                      required
                      rows={3}
                      placeholder="Explain the issue — an admin will review and decide whether to release payment or refund you."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <button type="submit" className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                      Escalate to admin
                    </button>
                  </form>
                </details>
              </div>
            )}
            {isBuyer && (order.status === 'paid' || order.status === 'in_progress') && (
              <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <details>
                  <summary className="text-sm font-medium text-gray-500 cursor-pointer dark:text-gray-400">Cancel this order</summary>
                  <form action="/api/orders/cancel" method="POST" className="mt-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <p className="text-xs text-gray-500 mb-2 dark:text-gray-400">
                      No work has been delivered yet — cancelling refunds your payment in full.
                    </p>
                    <button type="submit" className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-medium dark:text-gray-100">
                      Cancel &amp; refund
                    </button>
                  </form>
                </details>
              </div>
            )}
            {order.status === 'disputed' && (
              <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
                <p className="text-sm text-gray-700 font-medium mb-1 dark:text-gray-300">This order is under admin review.</p>
                {order.dispute_reason && <p className="text-sm text-gray-600 dark:text-gray-400">{order.dispute_reason}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  )
}
