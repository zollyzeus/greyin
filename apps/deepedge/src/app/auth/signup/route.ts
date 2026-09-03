import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const requestedRole = formData.get('role') as string
  // 'admin' must never be reachable through the public signup form --
  // the real gate is the DB trigger (handle_email_confirmed, 069), but
  // rejecting it here too means an invalid attempt never even reaches
  // GoTrue (SEC-001, 2026-08-24 security audit).
  const role = requestedRole === 'employer' ? 'employer' : 'candidate'
  const yearsExperienceRaw = formData.get('years_experience') as string
  const yearsExperience = yearsExperienceRaw ? parseInt(yearsExperienceRaw, 10) : null

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

  // No rejection here (unlike Salt & Pepper/FlexPro) -- signup stays
  // open per the "allow the account, limit what it can do" model.
  // Candidacy itself (applying to jobs, appearing in employer search) is
  // gated downstream by is_verified_expert, which this value feeds.
  const { error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: role,
        years_experience: yearsExperience,
      },
    },
  })

  if (authError) {
    return NextResponse.redirect(
      absoluteUrl(`/signup?error=${encodeURIComponent(authError.message)}`)
    )
  }

  // The profiles/companies/candidates rows are finalized by a DB trigger
  // once the user verifies their email (see migration 010) — not here, so
  // an abandoned/unverified signup never leaves a half-created account.
  return NextResponse.redirect(
    absoluteUrl(`/verify?email=${encodeURIComponent(email)}`)
  )
}
