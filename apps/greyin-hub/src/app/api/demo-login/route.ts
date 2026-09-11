import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { findDemoPersona } from '@/lib/demo-personas'
import { NextResponse } from 'next/server'

// One-click "Explore as X" for pitch reviewers and first-time visitors --
// signs a visitor into a real, curated seeded account with no signup and
// no password ever touching the browser. `persona` is a public key into a
// static, checked-in map (lib/demo-personas.ts); the actual password
// lives only in the server-only DEMO_ACCOUNT_PASSWORD env var, read here
// and nowhere else.
//
// GET (not POST) so this can be a plain link/button on a marketing page,
// not a form -- mirrors the "one click" requirement. Rate-limited the
// same way signup is (075/137): keyed on client IP via X-Forwarded-For,
// since this is a public, unauthenticated, anonymous-abuse surface (a
// scripted client could otherwise hammer signInWithPassword directly
// against a real, publicly-known account).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const personaKey = url.searchParams.get('persona') || ''
  const persona = findDemoPersona(personaKey)

  if (!persona) {
    return NextResponse.redirect(absoluteUrl('/?error=' + encodeURIComponent('Unknown demo persona')))
  }

  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD
  if (!demoPassword) {
    return NextResponse.redirect(absoluteUrl('/?error=' + encodeURIComponent('Demo login is not configured')))
  }

  const supabase = await createClient()

  // Same IP-extraction + private/link-local skip logic as
  // apps/deepedge/src/app/auth/signup/route.ts (SEC-017 follow-up) --
  // a private/absent forwarded address means the chain didn't deliver a
  // real per-client IP, so the limit is skipped rather than bucketing
  // every real visitor under one shared Traefik-gateway key.
  const rawClientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const isPrivateOrUnknownIp =
    !rawClientIp || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|f[cd])/i.test(rawClientIp)

  if (!isPrivateOrUnknownIp) {
    const { data: allowed } = await supabase.rpc('check_rate_limit', {
      p_action: 'demo_login',
      p_key: rawClientIp,
      p_max_failures: 20,
      p_window_minutes: 60,
    })
    if (!allowed) {
      return NextResponse.redirect(
        absoluteUrl('/?error=' + encodeURIComponent('Too many demo-login attempts from this network. Please wait a while and try again.'))
      )
    }
    await supabase.rpc('record_rate_limit_attempt', { p_action: 'demo_login', p_key: rawClientIp, p_success: false })
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: persona.email,
    password: demoPassword,
  })

  if (error) {
    return NextResponse.redirect(absoluteUrl('/?error=' + encodeURIComponent('Demo login is temporarily unavailable')))
  }

  // Same call the real login route makes -- a demo visit registers
  // pillar membership just like a real login would.
  await supabase.rpc('ensure_pillar_membership', { p_pillar: 'deepedge', p_default_role: 'candidate' })

  return NextResponse.redirect(persona.landingUrl)
}
