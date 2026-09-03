import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const targetUserId = formData.get('target_user_id') as string
  const next = (formData.get('next') as string) || '/'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('followed_id', targetUserId)

  return NextResponse.redirect(absoluteUrl(next))
}
