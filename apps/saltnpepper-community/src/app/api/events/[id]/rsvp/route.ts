import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Toggle -- 'rsvp' inserts (RLS: own row only, notify_new_rsvp trigger
// fires), 'cancel' deletes. Capacity is a UI-layer nicety (disables the
// button once full) rather than an RLS-enforced ceiling -- a real
// waitlist/overbooking policy wasn't asked for, and enforcing it at the
// DB level would need a trigger race-check beyond this feature's scope.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()
  const action = formData.get('action') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/events/${id}`))
  }

  if (action === 'cancel') {
    await supabase.from('event_rsvps').delete().eq('event_id', id).eq('user_id', user.id)
  } else {
    await supabase.from('event_rsvps').insert({ event_id: id, user_id: user.id })
  }

  return NextResponse.redirect(absoluteUrl(`/events/${id}`))
}
