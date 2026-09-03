import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const skill = formData.get('skill') as string
  const featured = formData.get('featured') === 'true'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  // RLS ("Users manage their own skills") enforces this is the caller's
  // own skill row -- no separate ownership check needed here.
  await supabase.from('profile_skills').update({ featured }).eq('user_id', user.id).eq('skill', skill)

  return NextResponse.redirect(absoluteUrl('/profile'))
}
