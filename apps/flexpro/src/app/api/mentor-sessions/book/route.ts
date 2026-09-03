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
  const slotId = formData.get('slot_id') as string
  const gigId = formData.get('gig_id') as string

  // book_mentor_slot (056_mentor_sessions.sql) atomically locks the
  // slot and creates the gig_orders row -- a free session comes back
  // already 'paid' (no Razorpay involved); a paid one comes back
  // 'pending' and still needs the checkout flow.
  const { data: orderId, error } = await supabase.rpc('book_mentor_slot', { p_slot_id: slotId })

  if (error || !orderId) {
    return NextResponse.redirect(
      absoluteUrl(`/mentor-sessions/${gigId}?error=` + encodeURIComponent('That slot is no longer available.'))
    )
  }

  const { data: order } = await supabase.from('gig_orders').select('status').eq('id', orderId).single()

  return NextResponse.redirect(
    absoluteUrl(order?.status === 'paid' ? `/orders/${orderId}` : `/mentor-sessions/checkout/${orderId}`)
  )
}
