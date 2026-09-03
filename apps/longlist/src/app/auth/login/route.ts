import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = formData.get('next') as string

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(`/login?error=${encodeURIComponent(error.message)}`)
    )
  }

  // Same SSO-first-login registration every pillar does (022) -- this is
  // what lets an existing Greyin member land on longlist.greyin.net and
  // be a fully-registered Longlist member with zero separate signup step.
  // No builder/supporter-style role split here, unlike stackworks's login
  // route -- Longlist has one flat member role.
  await supabase.rpc('ensure_pillar_membership', {
    p_pillar: 'longlist',
    p_default_role: 'candidate',
  })

  // SEC-021 (2026-08-25 security audit): reject a backslash as well as
  // '//' -- see stackworks/deepedge's own login route for the full
  // rationale (browsers normalize \ to / when parsing a URL, so
  // /\evil.com would otherwise pass a naive check).
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
    return NextResponse.redirect(absoluteUrl(next))
  }

  return NextResponse.redirect(absoluteUrl('/dashboard'))
}
