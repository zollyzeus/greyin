import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const otherUserId = formData.get('other_user_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: conversationId, error } = await supabase.rpc('get_or_create_conversation', {
    other_user_id: otherUserId,
  })

  if (error || !conversationId) {
    console.error('Failed to start conversation:', error)
    return NextResponse.redirect(absoluteUrl('/messages'))
  }

  return NextResponse.redirect(absoluteUrl(`/messages/${conversationId}`))
}
