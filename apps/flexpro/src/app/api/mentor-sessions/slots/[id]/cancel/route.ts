import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  // RLS ("Mentors can delete their own open slots") enforces ownership
  // and that the slot is still open -- a booked slot can't be cancelled
  // this way.
  await supabase.from('mentor_session_slots').delete().eq('id', params.id)

  return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage'))
}
