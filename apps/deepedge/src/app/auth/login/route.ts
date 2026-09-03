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

  // Records that this account is active on the DeepEdge pillar — a no-op if
  // it already knows that (e.g. they signed up here directly), but this is
  // what lets someone who signed up on a *different* pillar and is now
  // logging into DeepEdge for the first time (shared credentials via SSO)
  // show up in the cross-pillar "your account" view.
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

  // Get user profile to determine dashboard redirect
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (profile?.role === 'employer') {
    return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
  } else {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }
}
