import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// The mutual-confirmation gate (both rater and ratee already
// 'confirmed' on this project) lives entirely in
// peer_project_ratings' own RLS INSERT policy -- this route is a
// thin wrapper, not a second enforcement point.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/dashboard'))
  }

  const formData = await request.formData()
  const projectId = (formData.get('project_id') as string || '').trim()
  const rateeId = (formData.get('ratee_id') as string || '').trim()
  const rating = parseInt(formData.get('contribution_rating') as string, 10)

  if (!projectId || !rateeId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  await supabase.from('peer_project_ratings').insert({
    project_id: projectId,
    rater_id: user.id,
    ratee_id: rateeId,
    contribution_rating: rating,
  })

  return NextResponse.redirect(absoluteUrl('/dashboard?peer_rating_submitted=1'))
}
