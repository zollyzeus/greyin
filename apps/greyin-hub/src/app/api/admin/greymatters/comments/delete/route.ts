import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Ported from apps/greymatters-blog/src/app/api/admin/comments/delete/route.ts (Phase 3).
export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const commentId = formData.get('comment_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  await supabase.from('comments').delete().eq('id', commentId)

  return NextResponse.redirect(absoluteUrl('/admin/greymatters'))
}
