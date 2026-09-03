import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

function authHeader() {
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
}

// Mirrors deepedge's subscriptions/checkout/create almost exactly
// (093's flexpro_subscriptions was deliberately modeled on
// company_subscriptions for this reason) -- the one real difference is
// this is user-scoped, not company-scoped: FreeAgent has no company
// concept, individuals post directly as either freelancer or client,
// and one subscription covers both roles.
//
// 096 replaced the single fixed 'flexpro_pro' plan with 3 tiers
// (subscription_tiers, product='flexpro_posting') an admin can
// price and allocate credits for -- the caller now picks one.
// plan_id still points at the legacy subscription_plans 'flexpro_pro'
// row purely to satisfy the pre-existing NOT NULL FK; tier_id is what
// price, and going forward posting-credit checks, actually key off.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tierKey } = await request.json().catch(() => ({ tierKey: null }))
  if (!tierKey || !['basic', 'pro', 'premium'].includes(tierKey)) {
    return NextResponse.json({ error: 'Choose a subscription tier' }, { status: 400 })
  }

  const admin = createSupabaseClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tier } = await admin
    .from('subscription_tiers')
    .select('*')
    .eq('product', 'flexpro_posting')
    .eq('tier_key', tierKey)
    .eq('active', true)
    .single()
  if (!tier) {
    return NextResponse.json({ error: 'That tier is not available' }, { status: 400 })
  }

  const { data: legacyPlan } = await admin.from('subscription_plans').select('id').eq('tier', 'flexpro_pro').single()
  if (!legacyPlan) {
    return NextResponse.json({ error: 'FlexPro Pro plan not configured' }, { status: 500 })
  }

  let razorpayPlanId: string | null = tier.razorpay_plan_id
  if (!razorpayPlanId) {
    const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
      body: JSON.stringify({
        period: tier.billing_cycle === 'annual' ? 'yearly' : 'monthly',
        interval: 1,
        item: {
          name: `FlexPro ${tier.name} Subscription`,
          amount: tier.price_inr * 100,
          currency: 'INR',
        },
      }),
    })

    if (!planResponse.ok) {
      const error = await planResponse.json()
      console.error('Razorpay plan creation failed:', error)
      return NextResponse.json({ error: 'Failed to set up subscription plan' }, { status: 500 })
    }

    const razorpayPlan = await planResponse.json()
    razorpayPlanId = razorpayPlan.id
    await admin.from('subscription_tiers').update({ razorpay_plan_id: razorpayPlanId }).eq('id', tier.id)
  }

  const subscriptionResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: 120,
      notes: { user_id: user.id },
    }),
  })

  if (!subscriptionResponse.ok) {
    const error = await subscriptionResponse.json()
    console.error('Razorpay subscription creation failed:', error)
    return NextResponse.json({ error: 'Failed to start subscription' }, { status: 500 })
  }

  const razorpaySubscription = await subscriptionResponse.json()

  const { error: upsertError } = await admin.from('flexpro_subscriptions').upsert({
    user_id: user.id,
    plan_id: legacyPlan.id,
    tier_id: tier.id,
    status: 'pending',
    razorpay_subscription_id: razorpaySubscription.id,
    activated_by: null,
    activated_at: null,
  }, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('flexpro_subscriptions upsert failed:', upsertError)
    return NextResponse.json({ error: 'Failed to prepare subscription' }, { status: 500 })
  }

  return NextResponse.json({
    subscriptionId: razorpaySubscription.id,
    keyId: RAZORPAY_KEY_ID,
  })
}
