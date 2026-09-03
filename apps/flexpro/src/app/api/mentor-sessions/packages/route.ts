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
  const gigId = formData.get('gig_id') as string
  const title = formData.get('title') as string
  const sessionCount = parseInt(formData.get('session_count') as string, 10)
  const price = parseInt(formData.get('price') as string, 10)

  if (!gigId || !title || !sessionCount || sessionCount < 2 || Number.isNaN(price) || price < 0) {
    return NextResponse.redirect(
      absoluteUrl('/mentor-sessions/manage?error=' + encodeURIComponent('A package needs a title, at least 2 sessions, and a valid price.'))
    )
  }

  // RLS ("Mentors can create packages for their own mentor-session gigs")
  // enforces ownership -- no separate check needed here.
  await supabase.from('mentor_packages').insert({
    gig_id: gigId,
    mentor_id: user.id,
    title,
    session_count: sessionCount,
    price,
  })

  return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage'))
}
