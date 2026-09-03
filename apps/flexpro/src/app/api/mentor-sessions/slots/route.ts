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
  const date = formData.get('date') as string
  const startTime = formData.get('start_time') as string
  const endTime = formData.get('end_time') as string
  const capacityRaw = formData.get('capacity') as string | null
  const capacity = Math.max(1, parseInt(capacityRaw || '1', 10) || 1)

  if (!gigId || !date || !startTime || !endTime) {
    return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage?error=' + encodeURIComponent('Date, start time, and end time are required.')))
  }

  // RLS ("Mentors can create slots for their own mentor-session gigs")
  // enforces ownership -- no separate check needed here. capacity>1
  // (062_mentor_monetization.sql) makes this a cohort slot, booked via
  // book_cohort_slot() instead of book_mentor_slot().
  await supabase.from('mentor_session_slots').insert({
    gig_id: gigId,
    mentor_id: user.id,
    starts_at: new Date(`${date}T${startTime}`).toISOString(),
    ends_at: new Date(`${date}T${endTime}`).toISOString(),
    capacity,
  })

  return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage'))
}
