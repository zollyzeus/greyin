import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Thin wrapper around redeem_referral_code() (138) -- all real validation
// (self-referral, double-redemption, the 4-conversion cap, the actual
// reputation award) happens inside that SECURITY DEFINER function.
export async function POST(request: Request) {
  const formData = await request.formData()
  const code = formData.get('code') as string

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=${encodeURIComponent(`/referral/redeem?code=${code}`)}`))
  }

  if (!code) {
    return NextResponse.redirect(absoluteUrl('/referral/redeem?error=' + encodeURIComponent('Missing referral code')))
  }

  const { error } = await supabase.rpc('redeem_referral_code', { p_code: code })

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(`/referral/redeem?code=${encodeURIComponent(code)}&error=${encodeURIComponent(error.message)}`)
    )
  }

  return NextResponse.redirect(absoluteUrl(`/referral/redeem?code=${encodeURIComponent(code)}&redeemed=1`))
}
