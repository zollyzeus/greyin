import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Deleting a single reply on its own, distinct from
// api/admin/discussions/delete (which removes a whole thread, cascading to
// every reply on it) -- 099 added the RLS policy this needed since no
// admin capability touched an individual reply before.
export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const replyId = formData.get('reply_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  await supabase.from('discussion_replies').delete().eq('id', replyId)

  return NextResponse.redirect(absoluteUrl('/admin'))
}
