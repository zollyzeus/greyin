import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const CREDIT_TYPES = ['job_post', 'profile_view', 'contact_view', 'job_invite', 'outplacement_post', 'placement_request']

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const tierId = formData.get('tier_id') as string
  const priceInr = parseInt(formData.get('price_inr') as string, 10)
  const returnTo = (formData.get('return_to') as string) || '/admin/subscription-tiers'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  if (!tierId || Number.isNaN(priceInr)) {
    return NextResponse.redirect(absoluteUrl(returnTo + '?error=' + encodeURIComponent('Missing or invalid values')))
  }

  const creditRows = CREDIT_TYPES.map((creditType) => {
    const allowance = parseInt(formData.get(`credit_${creditType}`) as string, 10)
    return { tier_id: tierId, credit_type: creditType, monthly_allowance: Number.isNaN(allowance) ? 0 : allowance }
  })

  // A tier's razorpay_plan_id is created lazily on first checkout and cached
  // forever (see subscriptions/checkout/create) -- Razorpay plans are
  // immutable, so if price_inr changes here without clearing that cache,
  // every subsequent checkout keeps billing the stale price silently.
  // Only clear it when the price actually changed, so an admin editing just
  // the credit allowances doesn't force a needless new Razorpay plan (and
  // doesn't affect subscribers already on the current plan either way --
  // they keep their existing price until they resubscribe, by design).
  const { data: existingTier } = await supabase
    .from('subscription_tiers')
    .select('price_inr, razorpay_plan_id')
    .eq('id', tierId)
    .single()

  const priceChanged = existingTier != null && existingTier.price_inr !== priceInr
  const updatePayload: { price_inr: number; razorpay_plan_id?: null } = { price_inr: priceInr }
  if (priceChanged && existingTier!.razorpay_plan_id) {
    updatePayload.razorpay_plan_id = null
  }

  const { error: priceError } = await supabase.from('subscription_tiers').update(updatePayload).eq('id', tierId)
  const { error: creditError } = await supabase
    .from('subscription_tier_credits')
    .upsert(creditRows, { onConflict: 'tier_id,credit_type' })

  if (priceError || creditError) {
    return NextResponse.redirect(absoluteUrl(returnTo + '?error=' + encodeURIComponent('Could not update tier')))
  }

  return NextResponse.redirect(absoluteUrl(returnTo + '?success=1'))
}
