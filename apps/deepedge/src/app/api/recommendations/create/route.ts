import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const recommendeeId = formData.get('recommendee_id') as string
  const body = (formData.get('body') as string || '').trim()

  if (!recommendeeId || !body) {
    return NextResponse.redirect(absoluteUrl(`/candidates/${recommendeeId}?error=` + encodeURIComponent('A recommendation needs some text.')))
  }

  // RLS ("Only real collaborators can write a recommendation", 065)
  // enforces no self-recommendation, a real collaborators (059) tie, and
  // forces status='pending' -- it only goes live once the recipient
  // approves it.
  const { error } = await supabase
    .from('written_recommendations')
    .insert({ recommender_id: user.id, recommendee_id: recommendeeId, body })

  if (error) {
    console.error('Failed to submit recommendation:', error)
    return NextResponse.redirect(
      absoluteUrl(`/candidates/${recommendeeId}?error=` + encodeURIComponent('Writing a recommendation requires a real collaboration with this person.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/candidates/${recommendeeId}?success=1`))
}
