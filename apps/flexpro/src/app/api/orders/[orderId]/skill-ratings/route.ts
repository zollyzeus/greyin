import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { orderId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: ratings } = await supabase
    .from('skill_ratings')
    .select('skill, rating')
    .eq('gig_order_id', params.orderId)
    .eq('rater_id', user.id)

  return NextResponse.json({ ratings: ratings || [] })
}

export async function POST(request: Request, { params }: { params: { orderId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { skill, rating, ratee_id: rateeId } = await request.json()
  if (!skill || !rating || !rateeId) {
    return NextResponse.json({ error: 'skill, rating, and ratee_id are required' }, { status: 400 })
  }

  // RLS ("Buyers can rate completed order skills") enforces the buyer/
  // completed-order/tagged-skill gate -- a failure here is a real
  // rejection (wrong buyer, order not completed, or skill not tagged
  // on this gig), not just a formality.
  const { error } = await supabase
    .from('skill_ratings')
    .insert({ rater_id: user.id, ratee_id: rateeId, skill, rating, gig_order_id: params.orderId })

  if (error) {
    return NextResponse.json({ error: 'Could not save rating.' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
