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

  const { data: slot } = await supabase.from('mentor_session_slots').select('gig_id').eq('id', id).single()

  // purchase_recording_access() (062) creates the gig_orders row and
  // the purchase record atomically -- anyone can buy access, not just
  // whoever attended the live session.
  const { data: orderId, error } = await supabase.rpc('purchase_recording_access', { p_slot_id: id })

  if (error || !orderId) {
    return NextResponse.redirect(
      absoluteUrl(`/mentor-sessions/${slot?.gig_id || ''}?error=` + encodeURIComponent('That recording is not available for purchase.'))
    )
  }

  const { data: order } = await supabase.from('gig_orders').select('status').eq('id', orderId).single()

  return NextResponse.redirect(
    absoluteUrl(order?.status === 'paid' ? `/orders/${orderId}` : `/mentor-sessions/checkout/${orderId}`)
  )
}
