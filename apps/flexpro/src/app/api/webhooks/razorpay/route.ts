import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  sendOrderConfirmationEmail,
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
  sendRefundProcessedEmail
} from '@/lib/email'

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

// Verify Razorpay webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const crypto = require('crypto')
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  // SEC-019 (2026-08-25 security audit): a plain === comparison on hex
  // digests leaks timing information proportional to how many leading
  // characters match, letting an attacker who can measure response
  // latency recover the expected signature byte-by-byte over many
  // requests. timingSafeEqual runs in constant time for equal-length
  // inputs; the length check first is safe (not itself a useful timing
  // oracle -- signature length is fixed by the hash algorithm, not secret
  // material) and required since timingSafeEqual throws on mismatched
  // buffer lengths rather than returning false.
  const expected = Buffer.from(expectedSignature)
  const actual = Buffer.from(signature)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export async function POST(request: Request) {
  try {
    const headersList = await headers()
    const signature = headersList.get('x-razorpay-signature')
    
    if (!signature) {
      console.error('Missing Razorpay signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    // Get raw body for signature verification
    const rawBody = await request.text()
    
    // Verify signature
    const isValid = verifyWebhookSignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Parse the event
    const event = JSON.parse(rawBody)
    const eventType = event.event
    const payload = event.payload

    console.log(`Received Razorpay webhook: ${eventType}`)

    // Razorpay calls this route server-to-server, with no user session/
    // cookies at all — the anon-key SSR client (auth.uid() = NULL) can't
    // satisfy any of gig_orders' RLS update policies (all require
    // auth.uid() = buyer_id/seller_id or admin), so every update below
    // would previously silently affect zero rows despite this route
    // returning 200. The HMAC signature check above is this route's real
    // authorization, so a service-role client (RLS-bypassing) is correct
    // here, same trust model as e2e/utils/admin.ts's service-role helpers.
    // IMPORTANT: this also means enforce_gig_order_transition (073) does
    // NOT run its usual guards for updates made through this client —
    // that trigger explicitly exempts service_role/postgres/supabase_admin
    // as trusted callers. Every state-changing update below has to carry
    // its own transition guard as a result (see each handler).
    const supabase = createSupabaseClient(
      process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // SEC-018 (2026-08-25 security audit): razorpay_webhooks.event_id has
    // a real UNIQUE constraint, so a genuine redelivery of the exact same
    // event_id already fails here -- but that previously fell through to
    // the outer catch and returned 500, which just makes Razorpay retry
    // the same event again (and 500 again), a pointless retry storm
    // rather than the idempotent 200 a duplicate delivery should get.
    // Detecting it explicitly turns "already processed" into a no-op
    // success instead of an error loop.
    const eventId = event.event_id || `${eventType}_${Date.now()}`
    const { error: insertError } = await supabase.from('razorpay_webhooks').insert({
      event_id: eventId,
      event_type: eventType,
      payload: payload,
      processed: false,
      created_at: new Date().toISOString(),
    })
    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`Duplicate webhook delivery for event_id ${eventId}, already processed -- no-op`)
        return NextResponse.json({ status: 'already processed' })
      }
      throw insertError
    }

    // Handle different event types
    switch (eventType) {
      case 'payment.authorized':
        await handlePaymentAuthorized(supabase, payload)
        break
      
      case 'payment.captured':
        await handlePaymentCaptured(supabase, payload)
        break
      
      case 'payment.failed':
        await handlePaymentFailed(supabase, payload)
        break
      
      case 'order.paid':
        await handleOrderPaid(supabase, payload)
        break
      
      case 'refund.created':
        await handleRefundCreated(supabase, payload)
        break
      
      default:
        console.log(`Unhandled event type: ${eventType}`)
    }

    // Mark webhook as processed. Reuses the same eventId computed before
    // the insert above -- recomputing `${eventType}_${Date.now()}` here
    // (the previous code) would produce a different fallback value than
    // what was actually inserted whenever event.event_id was missing,
    // silently updating zero rows.
    await supabase
      .from('razorpay_webhooks')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', eventId)

    return NextResponse.json({ status: 'success' })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handler for payment.authorized event
async function handlePaymentAuthorized(supabase: any, payload: any) {
  const payment = payload.payment.entity
  const orderId = payment.order_id

  console.log(`Payment authorized: ${payment.id} for order: ${orderId}`)

  // Find order by razorpay_order_id
  const { data: order } = await supabase
    .from('gig_orders')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .single()

  if (!order) {
    console.error(`Order not found for razorpay_order_id: ${orderId}`)
    return
  }

  // Update order with payment details
  await supabase
    .from('gig_orders')
    .update({
      razorpay_payment_id: payment.id,
      status: 'authorized',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  console.log(`Order ${order.id} marked as authorized`)
}

// Handler for payment.captured event
async function handlePaymentCaptured(supabase: any, payload: any) {
  const payment = payload.payment.entity
  const orderId = payment.order_id

  console.log(`Payment captured: ${payment.id} for order: ${orderId}`)

  // Find order by razorpay_order_id
  const { data: order } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(title), buyer:profiles!buyer_id(full_name, email), seller:profiles!seller_id(full_name, email)')
    .eq('razorpay_order_id', orderId)
    .single()

  if (!order) {
    console.error(`Order not found for razorpay_order_id: ${orderId}`)
    return
  }

  // SEC-018 (2026-08-25 security audit): this route runs as service_role,
  // which enforce_gig_order_transition (073) explicitly trusts and skips
  // -- so nothing in the DB stops this handler from flipping an already
  // -refunded/cancelled/completed order back to 'paid' if a payment.captured
  // event for it arrives late or out of order (Razorpay does not guarantee
  // in-order delivery). Only orders still genuinely awaiting payment can be
  // moved to 'paid' here.
  if (!['pending', 'authorized'].includes(order.status)) {
    console.log(`Ignoring payment.captured for order ${order.id}: status is already '${order.status}', not a pre-payment state`)
    return
  }

  // Update order status to paid
  await supabase
    .from('gig_orders')
    .update({
      razorpay_payment_id: payment.id,
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  console.log(`Order ${order.id} marked as paid`)

  // Send email notifications
  if (order.buyer?.email && order.seller?.email) {
    await sendOrderConfirmationEmail({
      buyerEmail: order.buyer.email,
      buyerName: order.buyer.full_name || 'Customer',
      orderId: order.id,
      gigTitle: order.gig?.title || 'Service',
      amount: order.amount,
      packageType: order.package_type || 'standard',
    })

    await sendPaymentReceivedEmail({
      sellerEmail: order.seller.email,
      sellerName: order.seller.full_name || 'Seller',
      orderId: order.id,
      gigTitle: order.gig?.title || 'Service',
      amount: order.amount,
      buyerName: order.buyer.full_name || 'Customer',
    })
  }
}

// Handler for payment.failed event
async function handlePaymentFailed(supabase: any, payload: any) {
  const payment = payload.payment.entity
  const orderId = payment.order_id

  console.log(`Payment failed: ${payment.id} for order: ${orderId}`)

  // Find order by razorpay_order_id
  const { data: order } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(title), buyer:profiles!buyer_id(full_name, email)')
    .eq('razorpay_order_id', orderId)
    .single()

  if (!order) {
    console.error(`Order not found for razorpay_order_id: ${orderId}`)
    return
  }

  // Update order status to failed
  await supabase
    .from('gig_orders')
    .update({
      razorpay_payment_id: payment.id,
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  console.log(`Order ${order.id} marked as failed`)

  // Send payment failure notification to buyer
  if (order.buyer?.email) {
    await sendPaymentFailedEmail({
      buyerEmail: order.buyer.email,
      buyerName: order.buyer.full_name || 'Customer',
      orderId: order.id,
      gigTitle: order.gig?.title || 'Service',
      amount: order.amount,
      errorDescription: payment.error_description,
    })
  }
}

// Handler for order.paid event
async function handleOrderPaid(supabase: any, payload: any) {
  const order = payload.order.entity
  const orderId = order.id

  console.log(`Order paid event: ${orderId}`)

  // Find order by razorpay_order_id
  const { data: dbOrder } = await supabase
    .from('gig_orders')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .single()

  if (!dbOrder) {
    console.error(`Order not found for razorpay_order_id: ${orderId}`)
    return
  }

  // SEC-018 (2026-08-25 security audit): dbOrder.status !== 'paid' alone
  // would still flip a 'refunded' or 'cancelled' order back to 'paid' if
  // this event arrives out of order relative to a refund/cancellation --
  // same reasoning as handlePaymentCaptured above. Only pre-payment
  // states should ever move to 'paid' here.
  if (['pending', 'authorized'].includes(dbOrder.status)) {
    await supabase
      .from('gig_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', dbOrder.id)

    console.log(`Order ${dbOrder.id} marked as paid via order.paid event`)
  }
}

// Handler for refund.created event
async function handleRefundCreated(supabase: any, payload: any) {
  const refund = payload.refund.entity
  const paymentId = refund.payment_id

  console.log(`Refund created: ${refund.id} for payment: ${paymentId}`)

  // Find order by razorpay_payment_id
  const { data: order } = await supabase
    .from('gig_orders')
    .select('*, gig:gigs(title), buyer:profiles!buyer_id(full_name, email), seller:profiles!seller_id(full_name, email)')
    .eq('razorpay_payment_id', paymentId)
    .single()

  if (!order) {
    console.error(`Order not found for razorpay_payment_id: ${paymentId}`)
    return
  }

  // SEC-018 (2026-08-25 security audit): skip both the update and the
  // notification email if this order was already marked refunded (e.g.
  // by the app's own cancel/resolve-dispute routes, or an earlier
  // delivery of this same logical refund) -- otherwise a redelivered or
  // duplicate refund.created event re-sends the "your refund was
  // processed" email every time it arrives.
  if (order.status === 'refunded') {
    console.log(`Order ${order.id} is already refunded, ignoring duplicate refund.created event`)
    return
  }

  // Update order status to refunded
  await supabase
    .from('gig_orders')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  console.log(`Order ${order.id} marked as refunded`)

  // Send refund notification email to buyer
  if (order.buyer?.email) {
    await sendRefundProcessedEmail({
      buyerEmail: order.buyer.email,
      buyerName: order.buyer.full_name || 'Customer',
      orderId: order.id,
      gigTitle: order.gig?.title || 'Service',
      refundAmount: refund.amount / 100, // Razorpay amounts are in paise
    })
  }
}
