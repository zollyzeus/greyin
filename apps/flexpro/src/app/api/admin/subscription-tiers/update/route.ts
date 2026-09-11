import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const tierId = formData.get('tier_id') as string
  const priceInr = parseInt(formData.get('price_inr') as string, 10)
  const gigPostAllowance = parseInt(formData.get('gig_post_allowance') as string, 10)
  const returnTo = (formData.get('return_to') as string) || '/admin/subscription-tiers'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  if (!tierId || Number.isNaN(priceInr) || Number.isNaN(gigPostAllowance)) {
    return NextResponse.redirect(absoluteUrl(returnTo + '?error=' + encodeURIComponent('Missing or invalid values')))
  }

  // A tier's razorpay_plan_id is created lazily on first checkout and cached
  // forever (see subscriptions/checkout/create) -- Razorpay plans are
  // immutable, so if price_inr changes here without clearing that cache,
  // every subsequent checkout keeps billing the stale price silently.
  // Only clear it when the price actually changed, so an admin editing just
  // the credit allowance doesn't force a needless new Razorpay plan (and
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
    .upsert({ tier_id: tierId, credit_type: 'gig_post', monthly_allowance: gigPostAllowance }, { onConflict: 'tier_id,credit_type' })

  if (priceError || creditError) {
    return NextResponse.redirect(absoluteUrl(returnTo + '?error=' + encodeURIComponent('Could not update tier')))
  }

  return NextResponse.redirect(absoluteUrl(returnTo + '?success=1'))
}
