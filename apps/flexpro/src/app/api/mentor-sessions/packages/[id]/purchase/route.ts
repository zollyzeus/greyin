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

  const { data: pkg } = await supabase.from('mentor_packages').select('gig_id').eq('id', id).single()

  // purchase_mentor_package() (062) atomically creates the gig_orders
  // row and grants the session credits -- same shape as book_mentor_slot.
  const { data: orderId, error } = await supabase.rpc('purchase_mentor_package', { p_package_id: id })

  if (error || !orderId) {
    return NextResponse.redirect(
      absoluteUrl(`/mentor-sessions/${pkg?.gig_id || ''}?error=` + encodeURIComponent('That package is no longer available.'))
    )
  }

  const { data: order } = await supabase.from('gig_orders').select('status').eq('id', orderId).single()

  return NextResponse.redirect(
    absoluteUrl(order?.status === 'paid' ? `/orders/${orderId}` : `/mentor-sessions/checkout/${orderId}`)
  )
}
