import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()
  const body = (formData.get('body') as string || '').trim()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  if (body) {
    // RLS (sender_id = auth.uid() AND caller is a participant) is the real
    // authorization boundary here.
    await supabase.from('direct_messages').insert({
      conversation_id: id,
      sender_id: user.id,
      body,
    })
  }

  return NextResponse.redirect(absoluteUrl(`/messages/${id}`))
}
