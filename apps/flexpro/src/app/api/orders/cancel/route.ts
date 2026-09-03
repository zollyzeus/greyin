import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { absoluteUrl } from '@/lib/site-url'
import { refundPayment } from '@/lib/razorpay'

// Escrow means the client's payment is captured but held, not handed to the
// freelancer — so cancelling before any deliverable exists ('paid' or
// 'in_progress') is a straightforward full refund, same as Upwork letting a
// client end a contract with nothing delivered yet. Once work has actually
// been delivered, a unilateral buyer cancellation would be unfair to the
// freelancer who did the work, so from 'delivered'/'revision_requested' the
// only paths are accept, request revision, or /api/orders/dispute (admin
// mediates from there).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const orderId = formData.get('orderId') as string

  if (!orderId) {
    return NextResponse.redirect(absoluteUrl('/orders'))
  }

  const { data: order } = await supabase
    .from('gig_orders')
    .select('id, buyer_id, status, amount, razorpay_payment_id')
    .eq('id', orderId)
    .single()

  if (!order || order.buyer_id !== user.id || !['paid', 'in_progress'].includes(order.status)) {
    return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
  }

  if (order.razorpay_payment_id) {
    // SEC-035 (2026-08-26 security audit): the SELECT above and the
    // refund call/UPDATE below used to have no lock between them -- two
    // concurrent requests (a double-click, a replayed request) could
    // both pass this same check before either UPDATE landed, both call
    // refundPayment(), and issue two real refunds. claim_order_
    // cancellation_refund (086) does a real row lock (SELECT ... FOR
    // UPDATE) plus the same buyer/status checks atomically, marking the
    // order as claimed before returning -- only the winner of a race
    // proceeds to actually call Razorpay.
    const { data: claimRows, error: claimError } = await supabase.rpc('claim_order_cancellation_refund', {
      p_order_id: orderId,
    })
    const claim = claimRows?.[0]
    if (claimError || !claim?.claimed) {
      return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
    }

    const refund = await refundPayment(claim.razorpay_payment_id, claim.amount, `cancel_${orderId.slice(0, 8)}`)
    if (!refund.success) {
      // Release the claim so a retry is possible -- refund_status back
      // to NULL, not 'processed'/'pending', matching the pre-claim state.
      await supabase.from('gig_orders').update({ refund_status: null }).eq('id', orderId)
      return NextResponse.redirect(absoluteUrl(`/orders/${orderId}?error=${encodeURIComponent(refund.error || 'Refund failed')}`))
    }

    await supabase
      .from('gig_orders')
      .update({
        status: 'cancelled',
        payment_status: 'refunded',
        refund_id: refund.refundId,
        refund_amount: claim.amount,
        refund_status: 'processed',
        refunded_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
  } else {
    // No captured payment on record — nothing to refund, just cancel.
    await supabase
      .from('gig_orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', orderId)
  }

  return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
}
