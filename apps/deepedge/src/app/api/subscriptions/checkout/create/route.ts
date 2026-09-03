import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

function authHeader() {
  return `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`
}

// 096 replaced the single fixed 'starter' plan with 3 admin-priced
// tiers (subscription_tiers, product='deepedge_hiring') carrying named
// credit allowances (job_post, profile_view, contact_view, job_invite,
// outplacement_post, placement_request) -- the caller now picks one.
// The Enterprise plan stays sales-led/invoiced via
// /api/admin/subscriptions/activate (unchanged, see FR-EE-13); this
// self-serve path is for the 3 new hiring tiers.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'employer') {
    return NextResponse.json({ error: 'Only employer accounts can subscribe' }, { status: 403 })
  }

  const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).single()
  if (!company) {
    return NextResponse.json({ error: 'No company profile found' }, { status: 404 })
  }

  const { tierKey } = await request.json().catch(() => ({ tierKey: null }))
  if (!tierKey || !['basic', 'pro', 'premium'].includes(tierKey)) {
    return NextResponse.json({ error: 'Choose a subscription tier' }, { status: 400 })
  }

  // Plan creation/caching and the subscription row itself are financial
  // state -- handled via the service-role client rather than the
  // company-owner-scoped RLS policy, matching the trust model documented
  // in migration 039.
  const admin = createSupabaseClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: tier } = await admin
    .from('subscription_tiers')
    .select('*')
    .eq('product', 'deepedge_hiring')
    .eq('tier_key', tierKey)
    .eq('active', true)
    .single()
  if (!tier) {
    return NextResponse.json({ error: 'That tier is not available' }, { status: 400 })
  }

  const { data: legacyPlan } = await admin.from('subscription_plans').select('id').eq('tier', 'starter').single()
  if (!legacyPlan) {
    return NextResponse.json({ error: 'Starter plan not configured' }, { status: 500 })
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
      // Razorpay requires a finite billing-cycle count; 120 monthly cycles
      // (10 years) approximates "until cancelled" without an open-ended
      // value the API doesn't support. The subscriber can cancel any time.
      total_count: 120,
      notes: { company_id: company.id, user_id: user.id },
    }),
  })

  if (!subscriptionResponse.ok) {
    const error = await subscriptionResponse.json()
    console.error('Razorpay subscription creation failed:', error)
    return NextResponse.json({ error: 'Failed to start subscription' }, { status: 500 })
  }

  const razorpaySubscription = await subscriptionResponse.json()

  // One row per company (UNIQUE company_id) -- re-subscribing after a
  // cancellation reuses the same row instead of accumulating history rows.
  const { error: upsertError } = await admin.from('company_subscriptions').upsert({
    company_id: company.id,
    plan_id: legacyPlan.id,
    tier_id: tier.id,
    status: 'pending',
    razorpay_subscription_id: razorpaySubscription.id,
    activated_by: null,
    activated_at: null,
  }, { onConflict: 'company_id' })

  if (upsertError) {
    console.error('company_subscriptions upsert failed:', upsertError)
    return NextResponse.json({ error: 'Failed to prepare subscription' }, { status: 500 })
  }

  return NextResponse.json({
    subscriptionId: razorpaySubscription.id,
    keyId: RAZORPAY_KEY_ID,
  })
}
