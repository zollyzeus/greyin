import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Anonymous submission (Emergent-parity gap #2, 144) -- reverses 101's
// deliberate "no anonymous submission" decision per the user's current
// explicit request. Rate-limited by client IP like every other public
// write added this session (same extraction/private-IP-skip logic as
// apps/deepedge/src/app/auth/signup/route.ts), tighter than demo-login's
// since spam feature requests are more visible to admins.
export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()

  const title = (formData.get('title') as string || '').trim()
  const description = (formData.get('description') as string || '').trim() || null
  if (!title) {
    return NextResponse.redirect(absoluteUrl('/wishlist?error=' + encodeURIComponent('A title is required.')))
  }

  let email: string | null = null
  if (!user) {
    email = (formData.get('email') as string || '').trim()
    if (!email || !email.includes('@')) {
      return NextResponse.redirect(absoluteUrl('/wishlist?error=' + encodeURIComponent('A valid email is required to suggest a feature without signing in.')))
    }

    const rawClientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const isPrivateOrUnknownIp =
      !rawClientIp || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|f[cd])/i.test(rawClientIp)
    if (!isPrivateOrUnknownIp) {
      const { data: allowed } = await supabase.rpc('check_rate_limit', {
        p_action: 'wishlist_anonymous',
        p_key: rawClientIp,
        p_max_failures: 5,
        p_window_minutes: 60,
      })
      if (!allowed) {
        return NextResponse.redirect(
          absoluteUrl('/wishlist?error=' + encodeURIComponent('Too many suggestions from this network. Please wait a while and try again, or sign in.'))
        )
      }
      await supabase.rpc('record_rate_limit_attempt', { p_action: 'wishlist_anonymous', p_key: rawClientIp, p_success: false })
    }
  }

  const { error } = await supabase.from('feature_requests').insert({
    user_id: user?.id ?? null,
    email,
    title,
    description,
  })
  if (error) {
    return NextResponse.redirect(absoluteUrl('/wishlist?error=' + encodeURIComponent('Could not submit your suggestion. Please try again.')))
  }

  return NextResponse.redirect(absoluteUrl('/wishlist'))
}
