import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { absoluteUrl } from '@/lib/site-url'

// Upwork lets a client reject a delivery and send it back with feedback
// instead of only "accept or do nothing" — funds stay in escrow (status
// never reaches 'completed', so it's never counted in the freelancer's
// earnings balance in earnings/page.tsx) until the client is satisfied.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const orderId = formData.get('orderId') as string
  const notes = (formData.get('notes') as string || '').trim()

  if (!orderId || !notes) {
    return NextResponse.redirect(absoluteUrl(orderId ? `/orders/${orderId}` : '/orders'))
  }

  const { data: order } = await supabase
    .from('gig_orders')
    .select('id, buyer_id, status')
    .eq('id', orderId)
    .single()

  if (!order || order.buyer_id !== user.id || order.status !== 'delivered') {
    return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
  }

  await supabase
    .from('gig_orders')
    .update({
      status: 'revision_requested',
      revision_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
}
