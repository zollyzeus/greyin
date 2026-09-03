import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { absoluteUrl } from '@/lib/site-url'

// The last rung of Upwork's dispute ladder: if a revision still doesn't
// satisfy the client, they can escalate instead of being stuck choosing
// between "accept work you don't want" and "cancel a contract the
// freelancer already delivered on". Funds stay frozen in escrow (status
// isn't 'completed', so earnings/page.tsx still excludes it) until an
// admin resolves it via /api/admin/orders/resolve-dispute.
//
// Was buyer-only -- a seller had no way to flag a bad-faith buyer (e.g.
// endless revision requests with no intent to ever accept and release
// payment) at all. Now either party on the order can raise it, under
// the same status window; disputed_by (093) records who, so the other
// party and admin resolution both know which side raised it rather
// than just that someone did.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const orderId = formData.get('orderId') as string
  const reason = (formData.get('reason') as string || '').trim()

  if (!orderId || !reason) {
    return NextResponse.redirect(absoluteUrl(orderId ? `/orders/${orderId}` : '/orders'))
  }

  const { data: order } = await supabase
    .from('gig_orders')
    .select('id, buyer_id, seller_id, status')
    .eq('id', orderId)
    .single()

  const isParticipant = order && (order.buyer_id === user.id || order.seller_id === user.id)
  if (!order || !isParticipant || !['delivered', 'revision_requested'].includes(order.status)) {
    return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
  }

  await supabase
    .from('gig_orders')
    .update({
      status: 'disputed',
      dispute_reason: reason,
      disputed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`))
}
