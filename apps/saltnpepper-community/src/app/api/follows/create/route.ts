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

  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: user.id, followed_id: targetUserId })

  // 23505 = unique_violation -- already following, treat as idempotent success.
  if (error && error.code !== '23505') {
    console.error('Failed to follow user:', error)
  }

  return NextResponse.redirect(absoluteUrl(next))
}
