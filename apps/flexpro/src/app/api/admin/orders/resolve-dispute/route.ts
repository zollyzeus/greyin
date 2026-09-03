import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { absoluteUrl } from '@/lib/site-url'
import { refundPayment } from '@/lib/razorpay'

// Mirrors Upwork Support's role once a dispute is escalated to them: an
// admin reviews the order and either releases escrow to the freelancer
// (status='completed', now counted in their earnings balance) or refunds
// the buyer (same refund path as a plain cancellation).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const formData = await request.formData()
  const orderId = formData.get('orderId') as string
  const resolution = formData.get('resolution') as string

  if (!orderId || !['release', 'refund'].includes(resolution)) {
    return NextResponse.redirect(absoluteUrl('/admin'))
  }

  const { data: order } = await supabase
    .from('gig_orders')
    .select('id, status, amount, razorpay_payment_id')
    .eq('id', orderId)
    .single()

  if (!order || order.status !== 'disputed') {
    return NextResponse.redirect(absoluteUrl('/admin'))
  }

  if (resolution === 'release') {
    await supabase
      .from('gig_orders')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', orderId)
    return NextResponse.redirect(absoluteUrl('/admin'))
  }

  if (order.razorpay_payment_id) {
    // SEC-035 (2026-08-26 security audit): same race as orders/cancel --
    // see claim_order_dispute_refund (086) for the real fix (a row lock
    // plus admin/status checks, atomically claimed before Razorpay is
    // ever called, so a double-click/replay can't issue two refunds).
    const { data: claimRows, error: claimError } = await supabase.rpc('claim_order_dispute_refund', {
      p_order_id: orderId,
    })
    const claim = claimRows?.[0]
    if (claimError || !claim?.claimed) {
      return NextResponse.redirect(absoluteUrl('/admin'))
    }

    const refund = await refundPayment(claim.razorpay_payment_id, claim.amount, `dispute_${orderId.slice(0, 8)}`)
    if (!refund.success) {
      await supabase.from('gig_orders').update({ refund_status: null }).eq('id', orderId)
      return NextResponse.redirect(absoluteUrl(`/admin?error=${encodeURIComponent(refund.error || 'Refund failed')}`))
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
    await supabase
      .from('gig_orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', orderId)
  }

  return NextResponse.redirect(absoluteUrl('/admin'))
}
