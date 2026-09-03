import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const role = formData.get('role') as string
  const yearsExperience = parseInt(formData.get('years_experience') as string, 10)

  // The years-of-experience bar is governance-adjustable (see migration
  // 041) rather than hardcoded, so a threshold an admin applies after the
  // platform_gate_settings vote actually takes effect here too, not just
  // in Greyin B2B's is_verified_expert. Read via a plain stateless fetch,
  // not the cookie-bound SSR client -- a brand-new visitor hitting signup
  // has no session yet, and making this the first PostgREST call on that
  // client here (before it's ever used for auth.signUp()) was found to
  // trigger a crash in @supabase/ssr's session-recovery path under load.
  // This is public config (anon-readable), so no session is needed anyway.
  let minYearsExperience = 12
  try {
    const gateRes = await fetch(
      `${process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/platform_gate_settings?id=eq.1&select=min_years_experience`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      }
    )
    const gateRows = await gateRes.json()
    if (gateRows?.[0]?.min_years_experience != null) {
      minYearsExperience = gateRows[0].min_years_experience
    }
  } catch (err) {
    console.error('Failed to fetch platform_gate_settings, falling back to 12:', err)
  }

  const supabase = await createClient()

  // SEC-017 (2026-08-25 security audit): mass automated account creation
  // had no rate limit anywhere in this codebase. Keyed by client IP (not
  // email -- an attacker doing mass signup uses a fresh email every
  // time, so an email-keyed limit would never trigger) via the reverse
  // proxy's X-Forwarded-For. Reuses 075's generic rate_limit_attempts
  // mechanism: every signup attempt is recorded with success=false
  // regardless of whether GoTrue actually accepts it, since
  // check_rate_limit's "failures" count is really just "recent
  // attempts" here -- unlike password-reset (where the field means
  // "wrong guess"), a successful account creation IS the abuse this is
  // meant to limit, so it has to count toward the cap too. Full captcha
  // (GOTRUE_SECURITY_CAPTCHA_*) needs a third-party provider decision
  // (hCaptcha/Turnstile/etc) this audit isn't making unilaterally --
  // tracked separately as a pending decision; this rate limit
  // meaningfully raises the bar without it.
  const rawClientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  // SEC-017 follow-up (2026-08-26): discovered in prod immediately after
  // shipping the fix below -- every request through this deployment's
  // Traefik was recorded under key '172.18.0.1', Traefik's own docker-
  // bridge gateway address, not a real per-client IP (confirmed via
  // `SELECT key, count(*) FROM rate_limit_attempts WHERE action='signup'`
  // showing a single shared key with 20 hits). Left unguarded, that
  // silently buckets every real signup on the platform under one shared
  // key -- locking out signup for EVERYONE after 10 total/hour, not 10
  // per attacker, a functional regression worse than the abuse this was
  // meant to stop. A private/link-local/absent address means the
  // forwarding chain didn't deliver a real distinguishing client IP, so
  // the rate limit is skipped entirely rather than enforced against a
  // meaningless shared key.
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

  // FlexPro is the paid-services marketplace for the same senior
  // population as Salt & Pepper -- gated on both sides (hiring and
  // offering services), not just freelancers, so it can't drift back into
  // being an open marketplace layered on top of the senior community.
  if (!Number.isFinite(yearsExperience) || yearsExperience < minYearsExperience) {
    return NextResponse.redirect(
      absoluteUrl(
        `/signup?error=${encodeURIComponent(`FlexPro is reserved for senior professionals with ${minYearsExperience}+ years of experience.`)}`
      )
    )
  }

  const { error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: role === 'freelancer' ? 'freelancer' : 'client',
        years_experience: yearsExperience,
      },
    },
  })

  if (authError) {
    return NextResponse.redirect(
      absoluteUrl(`/signup?error=${encodeURIComponent(authError.message)}`)
    )
  }

  // The profiles row is finalized by a DB trigger once the user verifies
  // their email (see migration 010) — not here, so an abandoned/unverified
  // signup never leaves a half-created account.
  return NextResponse.redirect(
    absoluteUrl(`/verify?email=${encodeURIComponent(email)}`)
  )
}
