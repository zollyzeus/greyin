import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = formData.get('next') as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(`/login?error=${encodeURIComponent(error.message)}`)
    )
  }

  // Records that this account is active on the Salt & Pepper pillar — a
  // no-op if it already knows that, but lets someone who signed up on a
  // *different* pillar and is now logging into Salt & Pepper for the
  // first time (shared credentials via SSO) show up in the cross-pillar view.
  await supabase.rpc('ensure_pillar_membership', { p_pillar: 'saltnpepper', p_default_role: 'member' })

  // Only redirect to relative, in-app paths (avoid open redirect via
  // `next`). SEC-021 (2026-08-25 security audit): startsWith('//') alone
  // missed a backslash bypass -- browsers normalize \ to / when parsing
  // a URL, so `/\evil.com` passes startsWith('/') and !startsWith('//')
  // as written, but new URL('/\evil.com', site) resolves to
  // https://evil.com/. Rejecting any backslash closes that without
  // needing full URL-parsing here (a legitimate in-app path never
  // contains one).
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
    return NextResponse.redirect(absoluteUrl(next))
  }

  return NextResponse.redirect(absoluteUrl('/dashboard'))
}
