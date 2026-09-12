import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

function authHeader() {
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
}

// Candidate-side counterpart to /api/subscriptions/checkout/create --
// same Razorpay Subscriptions flow, but for the single 'deepedge_candidate'
// tier (150) instead of the 3 employer 'deepedge_hiring' tiers. There's
// no per-candidate "company" row to key off, so candidate_subscriptions
// is keyed directly by user_id.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'employer') {
    return NextResponse.json({ error: 'Only candidate accounts can subscribe to Profile Insights' }, { status: 403 })
  }

  const admin = createSupabaseClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tier } = await admin
    .from('subscription_tiers')
    .select('*')
    .eq('product', 'deepedge_candidate')
    .eq('tier_key', 'premium')
    .eq('active', true)
    .single()
  if (!tier) {
    return NextResponse.json({ error: 'Profile Insights is not available right now' }, { status: 400 })
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
          name: `DeepEdge ${tier.name} Subscription`,
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

  const { error: upsertError } = await admin.from('candidate_subscriptions').upsert({
    user_id: user.id,
    tier_id: tier.id,
    status: 'pending',
    razorpay_subscription_id: razorpaySubscription.id,
    activated_by: null,
    activated_at: null,
  }, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('candidate_subscriptions upsert failed:', upsertError)
    return NextResponse.json({ error: 'Failed to prepare subscription' }, { status: 500 })
  }

  return NextResponse.json({
    subscriptionId: razorpaySubscription.id,
    keyId: RAZORPAY_KEY_ID,
  })
}
