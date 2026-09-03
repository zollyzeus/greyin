import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { absoluteUrl } from '@/lib/site-url'
import { sendOrderInProgressEmail, sendOrderCompletedEmail } from '@/lib/email'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  // Invoked via a native <form method="POST"> from the order detail page,
  // not fetch — the body is form-encoded, not JSON.
  const formData = await request.formData()
  const orderId = formData.get('orderId') as string
  const status = formData.get('status') as string

  // 'cancelled' is deliberately excluded — a paid order needs a refund
  // alongside the status change, which only /api/orders/cancel (and, for
  // disputed orders, /api/admin/orders/resolve-dispute) actually does.
  // Letting it through here would cancel the order while leaving the
  // buyer's captured payment stuck with no refund and no path to the
  // freelancer either.
  const validStatuses = ['in_progress', 'delivered', 'completed']
  if (!validStatuses.includes(status)) {
    return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
  }

  const { data: order } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(title), buyer:profiles!buyer_id(full_name, email), seller:profiles!seller_id(full_name, email)')
    .eq('id', orderId)
    .single()

  if (!order) {
    return NextResponse.redirect(absoluteUrl('/orders'))
  }

  const isSeller = order.seller_id === user.id
  const isBuyer = order.buyer_id === user.id

  if (!isSeller && !isBuyer) {
    return NextResponse.redirect(absoluteUrl('/orders'))
  }

  if ((status === 'in_progress' || status === 'delivered') && !isSeller) {
    return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
  }

  if (status === 'completed') {
    if (!isBuyer || order.status !== 'delivered') {
      return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
    }
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'in_progress' && !order.started_at) {
    updateData.started_at = new Date().toISOString()
  }
  if (status === 'delivered' && !order.delivered_at) {
    updateData.delivered_at = new Date().toISOString()
  }
  if (status === 'completed' && !order.completed_at) {
    updateData.completed_at = new Date().toISOString()
  }
  if (status === 'cancelled' && !order.cancelled_at) {
    updateData.cancelled_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('gig_orders')
    .update(updateData)
    .eq('id', orderId)

  if (error) {
    console.error('Order status update failed:', error)
    return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
  }

  if (status === 'in_progress' && order.buyer?.email) {
    await sendOrderInProgressEmail({
      buyerEmail: order.buyer.email,
      buyerName: order.buyer.full_name || 'Customer',
      orderId: order.id,
      gigTitle: order.gig?.title || 'Service',
      sellerName: order.seller?.full_name || 'Seller',
    })
  }

  if (status === 'completed' && order.seller?.email) {
    await sendOrderCompletedEmail({
      sellerEmail: order.seller.email,
      sellerName: order.seller.full_name || 'Seller',
      orderId: order.id,
      gigTitle: order.gig?.title || 'Service',
      buyerName: order.buyer?.full_name || 'Customer',
      amount: order.amount,
    })
  }

  return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
}
