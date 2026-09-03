// Razorpay Order Creation - Supabase Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Razorpay from 'https://esm.sh/razorpay@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { gigId, freelancerId, amount, currency = 'INR' } = await req.json()
    if (!gigId || !freelancerId || !amount) {
      throw new Error('Missing required fields')
    }

    // Create order in database
    const { data: order, error: orderError } = await supabaseClient
      .from('gig_orders')
      .insert({
        gig_id: gigId,
        client_id: user.id,
        freelancer_id: freelancerId,
        amount: amount,
        currency: currency,
        status: 'pending',
        payment_status: 'pending',
      })
      .select()
      .single()

    if (orderError) throw new Error(orderError.message)

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: Deno.env.get('RAZORPAY_KEY_ID')!,
      key_secret: Deno.env.get('RAZORPAY_KEY_SECRET')!,
    })

    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: currency,
      receipt: `GRY-${order.id.substring(0, 8)}`,
      payment_capture: 1,
    })

    // Update with Razorpay order ID
    await supabaseClient
      .from('gig_orders')
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq('id', order.id)

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          razorpay_order_id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key_id: Deno.env.get('RAZORPAY_KEY_ID'),
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
