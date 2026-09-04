import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gigId, packageType, orderId: preClaimedOrderId, clientJobEngagement } = await request.json()

    // client_job_application-originated orders (093) are pre-claimed by
    // api/client-jobs/.../accept -- amount and both service fees are
    // already computed and stored on that row (from the accepted
    // application's own proposed_price), same "never trust a client-
    // supplied amount" posture as the gig path below, just reading from
    // gig_orders directly instead of recomputing from a gig's price.
    if (clientJobEngagement) {
      if (!preClaimedOrderId) {
        return NextResponse.json({ error: 'Missing order id' }, { status: 400 })
      }
      const { data: existingOrder, error: fetchError } = await supabase
        .from('gig_orders')
        .select('id, amount, service_fee_buyer, buyer_id, razorpay_order_id')
        .eq('id', preClaimedOrderId)
        .eq('buyer_id', user.id)
        .single()
      if (fetchError || !existingOrder) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      if (existingOrder.razorpay_order_id) {
        return NextResponse.json({ error: 'Payment already initiated for this order' }, { status: 409 })
      }

      const chargeAmount = existingOrder.amount + existingOrder.service_fee_buyer
      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        },
        body: JSON.stringify({
          amount: Math.round(chargeAmount * 100),
          currency: 'INR',
          receipt: `job_${preClaimedOrderId.slice(0, 8)}_${Date.now()}`,
          notes: { client_job_engagement: 'true', buyer_id: user.id },
        }),
      })
      if (!razorpayResponse.ok) {
        const error = await razorpayResponse.json()
        console.error('Razorpay order creation failed:', error)
        return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
      }
      const razorpayOrder = await razorpayResponse.json()

      const { data: order, error: orderError } = await supabase
        .from('gig_orders')
        .update({ razorpay_order_id: razorpayOrder.id })
        .eq('id', preClaimedOrderId)
        .eq('buyer_id', user.id)
        .select()
        .single()
      if (orderError) {
        console.error('Order update failed:', orderError)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
      }

      return NextResponse.json({
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: RAZORPAY_KEY_ID,
      })
    }

    // Mentor-session bookings pre-claim their gig_orders row via
    // book_mentor_slot() (056_mentor_sessions.sql), which already stores
    // the correct amount (gig.price_min at claim time) directly on that
    // row -- same "trust the pre-claimed order's own amount, don't
    // recompute" posture as the clientJobEngagement branch above, since
    // this order was never priced by the basic/standard/premium
    // multiplier system below (mentor-sessions/checkout/[orderId]/page.tsx
    // sends packageType: 'mentor_session', which isn't a real multiplier
    // key and always 400'd here before this branch existed -- the "Pay &
    // confirm" button would alert() and never open Razorpay at all).
    if (preClaimedOrderId && !clientJobEngagement) {
      const { data: existingOrder, error: fetchError } = await supabase
        .from('gig_orders')
        .select('id, amount, buyer_id, razorpay_order_id')
        .eq('id', preClaimedOrderId)
        .eq('buyer_id', user.id)
        .single()
      if (fetchError || !existingOrder) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      if (existingOrder.razorpay_order_id) {
        return NextResponse.json({ error: 'Payment already initiated for this order' }, { status: 409 })
      }

      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        },
        body: JSON.stringify({
          amount: Math.round(existingOrder.amount * 100),
          currency: 'INR',
          receipt: `mentor_${preClaimedOrderId.slice(0, 8)}_${Date.now()}`,
          notes: { mentor_session: 'true', buyer_id: user.id },
        }),
      })
      if (!razorpayResponse.ok) {
        const error = await razorpayResponse.json()
        console.error('Razorpay order creation failed:', error)
        return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
      }
      const razorpayOrder = await razorpayResponse.json()

      const { data: order, error: orderError } = await supabase
        .from('gig_orders')
        .update({ razorpay_order_id: razorpayOrder.id })
        .eq('id', preClaimedOrderId)
        .eq('buyer_id', user.id)
        .select()
        .single()
      if (orderError) {
        console.error('Order update failed:', orderError)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
      }

      return NextResponse.json({
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: RAZORPAY_KEY_ID,
      })
    }

    // Validate input
    if (!gigId || !packageType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get gig details
    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('*, seller:profiles!freelancer_id(*)')
      .eq('id', gigId)
      .single()

    if (gigError || !gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 })
    }

    // The charged amount is always recomputed here from the gig's own
    // stored price, never trusted from the client -- SEC-003 (2026-08-24
    // security audit): the route used to charge whatever `amount` the
    // client sent, letting a buyer name their own price. Must exactly
    // match checkout/[id]/page.tsx's own basePrice/multiplier display,
    // which is why this fix only removes the client-trust, not the
    // pricing model itself.
    const basePrice = gig.price_min || 1000
    const PACKAGE_MULTIPLIERS: Record<string, number> = { basic: 1, standard: 2, premium: 3 }
    const multiplier = PACKAGE_MULTIPLIERS[packageType]
    if (!multiplier) {
      return NextResponse.json({ error: 'Invalid package type' }, { status: 400 })
    }
    const amount = basePrice * multiplier

    // Create Razorpay order
    const razorpayOrderData = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      // Razorpay caps receipt at 40 chars; a full uuid gigId plus prefix/timestamp
      // blew past that (54 chars), so every order creation was failing.
      receipt: `gig_${gigId.slice(0, 8)}_${Date.now()}`,
      notes: {
        gig_id: gigId,
        buyer_id: user.id,
        package_type: packageType,
      },
    }

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify(razorpayOrderData),
    })

    if (!razorpayResponse.ok) {
      const error = await razorpayResponse.json()
      console.error('Razorpay order creation failed:', error)
      return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
    }

    const razorpayOrder = await razorpayResponse.json()

    // Mentor-session bookings pre-claim their gig_orders row via
    // book_mentor_slot() (056_mentor_sessions.sql) so the slot and the
    // order are locked atomically -- this just attaches the Razorpay
    // order to that already-existing row instead of inserting a new
    // one, rather than reimplementing that atomicity here.
    const { data: order, error: orderError } = preClaimedOrderId
      ? await supabase
          .from('gig_orders')
          .update({ razorpay_order_id: razorpayOrder.id })
          .eq('id', preClaimedOrderId)
          .eq('buyer_id', user.id)
          .select()
          .single()
      : await supabase
          .from('gig_orders')
          .insert({
            gig_id: gigId,
            buyer_id: user.id,
            seller_id: gig.freelancer_id,
            package_type: packageType,
            amount: amount,
            status: 'pending',
            razorpay_order_id: razorpayOrder.id,
          })
          .select()
          .single()

    if (orderError) {
      console.error('Order creation failed:', orderError)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: RAZORPAY_KEY_ID,
    })

  } catch (error) {
    console.error('Order creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
