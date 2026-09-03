import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = formData.get('next') as string

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(`/login?error=${encodeURIComponent(error.message)}`)
    )
  }

  // Same pillar identifier deepedge's own login route registers --
  // the app moved to deepedge.greyin.net, but the internal pillar
  // value ('deepedge', constrained by pillar_memberships' own CHECK
  // constraint) didn't, and shouldn't: it's just as true that someone
  // logging in via the ecosystem hub is using their Greyin identity.
  await supabase.rpc('ensure_pillar_membership', { p_pillar: 'deepedge', p_default_role: 'candidate' })

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
