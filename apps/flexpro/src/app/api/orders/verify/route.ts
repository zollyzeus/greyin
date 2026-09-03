import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = await request.json()

    // Verify Razorpay signature
    const crypto = require('crypto')
    const shasum = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
    shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`)
    const digest = shasum.digest('hex')

    // SEC-019 (2026-08-25 security audit): timing-safe comparison -- see
    // webhooks/razorpay/route.ts's verifyWebhookSignature for the full
    // rationale (a plain !== leaks timing info proportional to matching
    // prefix length).
    const digestBuf = Buffer.from(digest)
    const signatureBuf = Buffer.from(typeof razorpaySignature === 'string' ? razorpaySignature : '')
    const signatureValid =
      digestBuf.length === signatureBuf.length && crypto.timingSafeEqual(digestBuf, signatureBuf)
    if (!signatureValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // SEC-004 (2026-08-24 security audit): a valid signature only proves
    // *a* real Razorpay payment happened -- not that it was for *this*
    // order. Without this check, a genuinely-completed cheap payment's
    // own (order_id, payment_id, signature) triple could be replayed
    // against a different, more expensive order's orderId, capturing it
    // for free. Binding to the order's own stored razorpay_order_id
    // (set at creation, in orders/create/route.ts) closes that.
    const { data: existingOrder, error: fetchError } = await supabase
      .from('gig_orders')
      .select('razorpay_order_id')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (existingOrder.razorpay_order_id !== razorpayOrderId) {
      return NextResponse.json({ error: 'Payment does not match this order' }, { status: 400 })
    }

    // Update order status
    const { data: order, error: orderError } = await supabase
      .from('gig_orders')
      .update({
        status: 'paid',
        payment_status: 'captured',
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        payment_captured_at: new Date().toISOString(),
        paid_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .select('*, gig:gigs(*), seller:profiles!seller_id(*)')
      .single()

    if (orderError) {
      console.error('Order update failed:', orderError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    return NextResponse.json({ success: true, order })

  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
