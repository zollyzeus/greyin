import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const recordingUrl = formData.get('recording_url') as string
  const priceRaw = formData.get('recording_price') as string
  const recordingPrice = parseInt(priceRaw, 10)

  if (!recordingUrl || Number.isNaN(recordingPrice) || recordingPrice < 0) {
    return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage?error=' + encodeURIComponent('A recording needs a URL and a valid price.')))
  }

  // RLS ("Mentors can attach a recording to their own slots") enforces
  // ownership -- no separate check needed here.
  await supabase
    .from('mentor_session_slots')
    .update({ recording_url: recordingUrl, recording_price: recordingPrice })
    .eq('id', id)

  return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage'))
}
