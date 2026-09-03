// ============================================================
// Razorpay Payment Verification - Supabase Edge Function
// ============================================================
// Deploy to: supabase/functions/verify-razorpay-payment
// 
// Usage: POST /functions/v1/verify-razorpay-payment
//        Body: { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature }
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = await req.json()

    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      throw new Error('Missing required fields')
    }

    // Get order from database
    const { data: order, error: orderError } = await supabaseClient
      .from('gig_orders')
      .select('id, client_id, razorpay_order_id, amount')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error('Order not found')
    }

    // Verify user is the client
    if (order.client_id !== user.id) {
      throw new Error('Unauthorized - not order owner')
    }

    // Verify Razorpay order ID matches
    if (order.razorpay_order_id !== razorpayOrderId) {
      throw new Error('Razorpay order ID mismatch')
    }

    // Verify signature
    const text = razorpayOrderId + '|' + razorpayPaymentId
    const secret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(text)
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData)
    const generatedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (generatedSignature !== razorpaySignature) {
      throw new Error('Invalid signature - payment verification failed')
    }

    // Update order with payment details
    const { error: updateError } = await supabaseClient
      .from('gig_orders')
      .update({
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        payment_status: 'captured',
        payment_captured_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .eq('id', orderId)

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`)
    }

    // Send notification to freelancer (optional)
    // TODO: Implement email/push notification

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified successfully',
        order_id: orderId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
