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

  const { error: priceError } = await supabase.from('subscription_tiers').update({ price_inr: priceInr }).eq('id', tierId)
  const { error: creditError } = await supabase
    .from('subscription_tier_credits')
    .upsert(creditRows, { onConflict: 'tier_id,credit_type' })

  if (priceError || creditError) {
    return NextResponse.redirect(absoluteUrl(returnTo + '?error=' + encodeURIComponent('Could not update tier')))
  }

  return NextResponse.redirect(absoluteUrl(returnTo + '?success=1'))
}
