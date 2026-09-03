import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// RLS (peer_project_members' UPDATE policy) already restricts this to
// the tagged member's own row and to confirmed/declined as the only
// reachable statuses -- this route doesn't re-derive that check, it
// just surfaces whatever RLS allowed (or silently didn't) back on the
// dashboard.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/dashboard'))
  }

  const formData = await request.formData()
  const memberId = (formData.get('member_id') as string || '').trim()
  const status = formData.get('status') as string

  if (!memberId || !['confirmed', 'declined'].includes(status)) {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  await supabase.from('peer_project_members').update({ status }).eq('id', memberId)

  return NextResponse.redirect(absoluteUrl('/dashboard'))
}
