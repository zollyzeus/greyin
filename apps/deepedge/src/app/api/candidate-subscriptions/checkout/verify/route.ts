import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

// Candidate-side counterpart to /api/subscriptions/checkout/verify -- same
// HMAC verification, same SEC-037 explicit-ownership-check defense-in-depth
// (a candidate_subscriptions row is keyed directly by user_id here, so the
// ownership check is even more direct than the company version's join).
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

    const crypto = require('crypto')
    const digest = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
      .digest('hex')

    if (digest !== razorpaySignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const admin = createSupabaseClient(
      process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: subscription } = await admin
      .from('candidate_subscriptions')
      .select('id, user_id')
      .eq('razorpay_subscription_id', razorpaySubscriptionId)
      .single()

    if (!subscription || subscription.user_id !== user.id) {
      return NextResponse.json({ error: 'Subscription not found for this account' }, { status: 404 })
    }

    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    const { error, data } = await admin
      .from('candidate_subscriptions')
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
      console.error('Candidate subscription activation failed:', error)
      return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Candidate subscription verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
