import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/profile'))
  }

  const formData = await request.formData()
  const rawInterests = (formData.get('future_interests') as string) || ''
  const note = (formData.get('future_interests_note') as string) || null

  const future_interests = rawInterests
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  await supabase
    .from('profiles')
    .update({ future_interests, future_interests_note: note })
    .eq('id', user.id)

  return NextResponse.redirect(absoluteUrl('/profile?saved=1'))
}
