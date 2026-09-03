import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/roles/${id}`))
  }

  await supabase
    .from('future_role_subscriptions')
    .delete()
    .eq('future_role_id', id)
    .eq('user_id', user.id)

  const referer = request.headers.get('referer')
  const fallback = absoluteUrl(`/roles/${id}`).toString()
  const redirectTo = referer && referer.includes(process.env.NEXT_PUBLIC_SITE_URL || '') ? referer : fallback

  return NextResponse.redirect(redirectTo)
}
