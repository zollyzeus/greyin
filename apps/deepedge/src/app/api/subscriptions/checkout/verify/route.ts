import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { razorpaySubscriptionId, razorpayPaymentId, razorpaySignature } = await request.json()
    if (!razorpaySubscriptionId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: 'Missing verification fields' }, { status: 400 })
    }

    // Razorpay Subscriptions' checkout handler signature is computed over
    // `payment_id|subscription_id` (not `order_id|payment_id`, the one-time
    // Orders API's formula used elsewhere in this codebase).
    const crypto = require('crypto')
    const digest = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
      .digest('hex')

    if (digest !== razorpaySignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // The signature check is the real proof a genuine payment happened,
    // but it doesn't prove the currently authenticated user is the one
    // who owns the company this subscription belongs to -- so the
    // update goes through the service-role client (bypassing RLS
    // intentionally, since a normal RLS-scoped update can't verify a
    // Razorpay HMAC), with an explicit ownership check added below
    // (SEC-037, 2026-08-26 security audit) as defense-in-depth: whoever
    // holds a valid signature triple for a subscription did, by
    // construction, complete that specific Razorpay checkout
    // themselves, so this is a narrow gap in practice, but nothing
    // previously stopped a different authenticated user from activating
    // a company they don't belong to if they ever obtained a valid
    // triple for it (e.g. a leaked/shared verify payload, a stale
    // client-side redirect on a shared browser).
    const admin = createSupabaseClient(
      process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: subscription } = await admin
      .from('company_subscriptions')
      .select('id, company_id, companies!inner(user_id)')
      .eq('razorpay_subscription_id', razorpaySubscriptionId)
      .single()

    if (!subscription || (subscription as any).companies?.user_id !== user.id) {
      return NextResponse.json({ error: 'Subscription not found for this account' }, { status: 404 })
    }

    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    const { error, data } = await admin
      .from('company_subscriptions')
      .update({
        status: 'active',
        current_period_end: periodEnd.toISOString(),
        activated_by: user.id,
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('razorpay_subscription_id', razorpaySubscriptionId)
      .select('id')

    if (error || !data?.length) {
      console.error('Subscription activation failed:', error)
      return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Subscription verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
