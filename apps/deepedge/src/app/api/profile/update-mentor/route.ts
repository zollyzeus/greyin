import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  // Same Verified Expert gate as the pivot tag, but this is deliberately
  // independent of is_pivoter -- a lifelong domain expert who never
  // personally pivoted can still be exactly the right mentor for someone
  // who is.
  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('is_verified_expert')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!scoreRow?.is_verified_expert) {
    return NextResponse.redirect(
      absoluteUrl(`/profile?error=${encodeURIComponent('Verified Expert status is required to list yourself as a mentor.')}`)
    )
  }

  const formData = await request.formData()
  const isMentor = formData.get('is_mentor') === 'on'
  const mentorDomain = ((formData.get('mentor_domain') as string) || '').trim() || null
  const mentorNote = ((formData.get('mentor_note') as string) || '').trim() || null

  const { error } = await supabase
    .from('profiles')
    .update({
      is_mentor: isMentor,
      mentor_domain: mentorDomain,
      mentor_note: mentorNote,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Mentor availability update failed:', error)
    return NextResponse.redirect(
      absoluteUrl(`/profile?error=${encodeURIComponent('Could not save your mentor availability.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl('/profile?success=1'))
}
