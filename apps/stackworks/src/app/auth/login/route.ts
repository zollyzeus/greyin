import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { isBuilder } from '@/lib/stackworks-role'
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

  // This is what makes an existing Salt & Pepper member usable as a
  // Builder on stackworks with zero stackworks-specific signup step: their
  // first login here registers them on the stackworks pillar, defaulted
  // to whichever track their existing years_experience already
  // qualifies them for.
  const { data: profile } = await supabase
    .from('profiles')
    .select('years_experience, stackworks_role')
    .eq('id', data.user.id)
    .single()

  await supabase.rpc('ensure_pillar_membership', {
    p_pillar: 'stackworks',
    p_default_role: profile && isBuilder(profile) ? 'builder' : 'supporter',
  })

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
