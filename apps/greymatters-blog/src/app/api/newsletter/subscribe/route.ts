import { absoluteUrl } from '@/app/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = (formData.get('email') as string || '').trim().toLowerCase()
  const redirectTo = (formData.get('redirect_to') as string) || '/'

  if (!email || !email.includes('@')) {
    return NextResponse.redirect(
      absoluteUrl(`${redirectTo}?newsletter_error=${encodeURIComponent('Enter a valid email address.')}`)
    )
  }

  // Plain stateless fetch, not the cookie-bound SSR client -- this call
  // needs no session, and a visitor who happens to already have a
  // session cookie in flight (e.g. just signed up elsewhere on
  // .greyin.net) hitting this as the first Supabase call on a fresh
  // client was found to risk the same @supabase/ssr session-recovery
  // crash the auth signup routes had.
  //
  // SEC-029 (2026-08-26 security audit): this used to INSERT directly
  // into newsletter_subscribers and treat a 23505 (duplicate email)
  // response the same as success -- a UI-layer courtesy only, since a
  // direct call to the raw table endpoint (bypassing this route
  // entirely) still got a genuinely different response for an
  // already-subscribed email, a real enumeration oracle. Now calls the
  // subscribe_to_newsletter RPC (081), which swallows the conflict
  // itself (ON CONFLICT DO NOTHING) and always returns the same thing
  // either way -- the direct table INSERT grant is revoked, so the
  // enumerable raw endpoint isn't reachable at all anymore.
  const res = await fetch(`${process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/subscribe_to_newsletter`, {
    method: 'POST',
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_email: email }),
  })

  if (!res.ok) {
    return NextResponse.redirect(
      absoluteUrl(`${redirectTo}?newsletter_error=${encodeURIComponent('Could not subscribe. Please try again.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl(`${redirectTo}?newsletter_success=1`))
}
