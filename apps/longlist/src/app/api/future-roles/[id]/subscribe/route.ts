import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// RLS (087) is the real gate here -- a member can only insert a row for
// themselves, against a still-open role. This route just does it and
// redirects back to wherever the subscribe button was clicked from.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/roles/${id}`))
  }

  const { error } = await supabase
    .from('future_role_subscriptions')
    .insert({ future_role_id: id, user_id: user.id })

  const referer = request.headers.get('referer')
  const fallback = absoluteUrl(`/roles/${id}`).toString()
  const redirectTo = referer && referer.includes(process.env.NEXT_PUBLIC_SITE_URL || '') ? referer : fallback

  if (error && error.code !== '23505' /* already subscribed -- treat as success */) {
    return NextResponse.redirect(`${redirectTo}${redirectTo.includes('?') ? '&' : '?'}error=${encodeURIComponent('Could not subscribe -- that role may have closed.')}`)
  }

  return NextResponse.redirect(redirectTo)
}
