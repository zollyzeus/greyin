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

  const { error: priceError } = await supabase.from('subscription_tiers').update({ price_inr: priceInr }).eq('id', tierId)
  const { error: creditError } = await supabase
    .from('subscription_tier_credits')
    .upsert({ tier_id: tierId, credit_type: 'gig_post', monthly_allowance: gigPostAllowance }, { onConflict: 'tier_id,credit_type' })

  if (priceError || creditError) {
    return NextResponse.redirect(absoluteUrl(returnTo + '?error=' + encodeURIComponent('Could not update tier')))
  }

  return NextResponse.redirect(absoluteUrl(returnTo + '?success=1'))
}
