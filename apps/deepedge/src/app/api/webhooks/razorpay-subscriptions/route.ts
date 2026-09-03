import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const crypto = require('crypto')
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  // SEC-019 (2026-08-25 security audit): timing-safe comparison -- see
  // flexpro's webhooks/razorpay/route.ts for the full
  // rationale (a plain === leaks timing info proportional to matching
  // prefix length).
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

    const rawBody = await request.text()
    const isValid = verifyWebhookSignature(rawBody, signature, RAZORPAY_WEBHOOK_SECRET)
    if (!isValid) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    const eventType = event.event
    const eventId = event.event_id || `${eventType}_${Date.now()}`

    console.log(`Received Razorpay subscription webhook: ${eventType}`)

    // Razorpay calls this route server-to-server with no user session --
    // same trust model as apps/flexpro's webhook: the HMAC
    // check above is the real authorization gate, so a service-role
    // (RLS-bypassing) client is correct here.
    const supabase = createSupabaseClient(
      process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const subscriptionEntity = event.payload?.subscription?.entity
    const razorpaySubscriptionId = subscriptionEntity?.id

    await supabase.from('subscription_webhooks').insert({
      event_id: eventId,
      event_type: eventType,
      razorpay_subscription_id: razorpaySubscriptionId,
      payload: event.payload,
      processed: false,
    })

    if (razorpaySubscriptionId) {
      switch (eventType) {
        case 'subscription.activated':
        case 'subscription.charged': {
          const periodEnd = subscriptionEntity?.current_end
            ? new Date(subscriptionEntity.current_end * 1000).toISOString()
            : null
          await supabase
            .from('company_subscriptions')
            .update({ status: 'active', current_period_end: periodEnd, updated_at: new Date().toISOString() })
            .eq('razorpay_subscription_id', razorpaySubscriptionId)
          break
        }

        case 'subscription.pending':
        case 'subscription.halted':
          await supabase
            .from('company_subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('razorpay_subscription_id', razorpaySubscriptionId)
          break

        case 'subscription.cancelled':
        case 'subscription.completed':
          await supabase
            .from('company_subscriptions')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('razorpay_subscription_id', razorpaySubscriptionId)
          break

        default:
          console.log(`Unhandled subscription webhook event: ${eventType}`)
      }
    }

    await supabase.from('subscription_webhooks').update({ processed: true }).eq('event_id', eventId)

    return NextResponse.json({ status: 'success' })
  } catch (error) {
    console.error('Subscription webhook processing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
