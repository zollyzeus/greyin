import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// Deliberately server-side (unlike a typical client-driven OTP form): the
// browser-side Supabase client writes its session cookie without the
// `.greyin.net` domain the rest of the app uses (see lib/supabase/client.ts
// for why it can't safely be given one), so a session started here would be
// a host-only cookie that /auth/logout's domain-scoped clearing can never
// remove — the user would appear logged out but still have a live session.
// Routing verifyOtp/updateUser through the server client (same as
// auth/login/route.ts) keeps the cookie consistent with every other
// session-creating flow in the app.
export async function POST(request: Request) {
  const { email, code, password } = await request.json()

  const supabase = await createClient()

  // SEC-015 (2026-08-24 security audit): the 6-digit recovery code had no
  // guess limit at all -- GoTrue's own rate limit only covers *sending*
  // the reset email, not *guessing* the code afterward. check_rate_limit
  // (075) counts recent failed attempts for this email; 5 failures locks
  // further attempts out for 20 minutes.
  const { data: allowed } = await supabase.rpc('check_rate_limit', {
    p_action: 'password_reset',
    p_key: email,
    p_max_failures: 5,
    p_window_minutes: 20,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a while and request a new code.' }, { status: 429 })
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'recovery',
  })
  if (verifyError) {
    await supabase.rpc('record_rate_limit_attempt', { p_action: 'password_reset', p_key: email, p_success: false })
    return NextResponse.json({ error: verifyError.message }, { status: 400 })
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    await supabase.rpc('record_rate_limit_attempt', { p_action: 'password_reset', p_key: email, p_success: false })
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  await supabase.rpc('record_rate_limit_attempt', { p_action: 'password_reset', p_key: email, p_success: true })
  return NextResponse.json({ success: true })
}
