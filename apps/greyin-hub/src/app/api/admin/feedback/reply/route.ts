import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const feedbackId = formData.get('feedback_id') as string
  const adminReply = (formData.get('admin_reply') as string || '').trim()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  if (!adminReply) {
    return NextResponse.redirect(absoluteUrl('/admin/feedback'))
  }

  // The notify_feedback_replied trigger (101) fires on this update.
  await supabase
    .from('platform_feedback')
    .update({ admin_reply: adminReply, status: 'replied', replied_by: user.id, replied_at: new Date().toISOString() })
    .eq('id', feedbackId)

  return NextResponse.redirect(absoluteUrl('/admin/feedback'))
}
