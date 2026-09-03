import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// No track/experience gate here, unlike stackworks's signup -- Longlist
// has no builder/supporter split and no years-of-experience floor.
// Browsing and subscribing to future roles is open to any member;
// posting a role requires an existing company (created via DeepEdge's
// employer onboarding), checked at post-time, not at signup.
export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string

  const supabase = await createClient()

  // SEC-017 (2026-08-25 security audit): same IP-keyed signup rate limit
  // as every other app's signup route -- see deepedge/stackworks's own
  // auth/signup/route.ts for the full rationale, including the
  // private/link-local-IP skip (SEC-017 follow-up, 2026-08-26) that
  // avoids bucketing every real signup under Traefik's shared gateway
  // address.
  const rawClientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const isPrivateOrUnknownIp =
    !rawClientIp || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|f[cd])/i.test(rawClientIp)
  if (!isPrivateOrUnknownIp) {
    const { data: signupAllowed } = await supabase.rpc('check_rate_limit', {
      p_action: 'signup',
      p_key: rawClientIp,
      p_max_failures: 10,
      p_window_minutes: 60,
    })
    if (!signupAllowed) {
      return NextResponse.redirect(
        absoluteUrl(`/signup?error=${encodeURIComponent('Too many signup attempts from this network. Please wait a while and try again.')}`)
      )
    }
    await supabase.rpc('record_rate_limit_attempt', { p_action: 'signup', p_key: rawClientIp, p_success: false })
  }

  const { error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: 'candidate',
      },
    },
  })

  if (authError) {
    return NextResponse.redirect(
      absoluteUrl(`/signup?error=${encodeURIComponent(authError.message)}`)
    )
  }

  return NextResponse.redirect(
    absoluteUrl(`/verify?email=${encodeURIComponent(email)}`)
  )
}
