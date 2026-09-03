// ============================================================
// Razorpay Webhook Handler - Supabase Edge Function
// ============================================================
// Deploy to: supabase/functions/razorpay-webhook
// 
// Configure in Razorpay Dashboard:
//   URL: https://api.greyin.net/functions/v1/razorpay-webhook
//   Events: payment.*, order.*, refund.*
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

serve(async (req) => {
  try {
    // Get webhook signature
    const signature = req.headers.get('x-razorpay-signature')
    if (!signature) {
      throw new Error('Missing webhook signature')
    }

    // Get raw body
    const bodyText = await req.text()
    
    // Verify webhook signature
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(bodyText)
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const signatureVerified = signature === expectedSignature

    // Parse webhook event
    const event = JSON.parse(bodyText)
    
    // Initialize Supabase with service role key (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Log webhook to database
    const { error: webhookLogError } = await supabaseAdmin
      .from('razorpay_webhooks')
      .insert({
        event_id: event.event,
        event_type: event.event,
        razorpay_order_id: event.payload?.order?.entity?.id || event.payload?.payment?.entity?.order_id,
        razorpay_payment_id: event.payload?.payment?.entity?.id,
        payload: event,
        signature: signature,
        signature_verified: signatureVerified,
      })

    if (webhookLogError) {
      console.error('Failed to log webhook:', webhookLogError)
    }

    // Process webhook if signature is valid
    if (!signatureVerified) {
      console.error('Invalid webhook signature')
      return new Response('Invalid signature', { status: 400 })
    }

    // Process different event types
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(supabaseAdmin, event)
        break
      
      case 'payment.failed':
        await handlePaymentFailed(supabaseAdmin, event)
        break
      
      case 'order.paid':
        await handleOrderPaid(supabaseAdmin, event)
        break
      
      case 'refund.created':
      case 'refund.processed':
        await handleRefund(supabaseAdmin, event)
        break
      
      default:
        console.log('Unhandled event type:', event.event)
    }

    // Mark webhook as processed
    await supabaseAdmin
      .from('razorpay_webhooks')
      .update({ 
        processed: true, 
        processed_at: new Date().toISOString() 
      })
      .eq('event_id', event.event)

    return new Response('OK', { status: 200 })
    
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(error.message, { status: 500 })
  }
})

// ============================================================
// Event Handlers
// ============================================================

async function handlePaymentCaptured(supabase: any, event: any) {
  const payment = event.payload.payment.entity
  
  console.log('Payment captured:', payment.id)
  
  // Find order by Razorpay order ID
  const { data: orders } = await supabase
    .from('gig_orders')
    .select('id')
    .eq('razorpay_order_id', payment.order_id)
    .single()
  
  if (orders) {
    await supabase
      .from('gig_orders')
      .update({
        razorpay_payment_id: payment.id,
        payment_status: 'captured',
        payment_method: payment.method,
        payment_captured_at: new Date(payment.created_at * 1000).toISOString(),
        status: 'in_progress',
      })
      .eq('id', orders.id)
    
    console.log('Order updated:', orders.id)
  }
}

async function handlePaymentFailed(supabase: any, event: any) {
  const payment = event.payload.payment.entity
  
  console.log('Payment failed:', payment.id)
  
  const { data: orders } = await supabase
    .from('gig_orders')
    .select('id')
    .eq('razorpay_order_id', payment.order_id)
    .single()
  
  if (orders) {
    await supabase
      .from('gig_orders')
      .update({
        payment_status: 'failed',
        payment_error_code: payment.error_code,
        payment_error_description: payment.error_description,
        status: 'cancelled',
      })
      .eq('id', orders.id)
    
    console.log('Order marked as failed:', orders.id)
  }
}

async function handleOrderPaid(supabase: any, event: any) {
  const order = event.payload.order.entity
  
  console.log('Order paid:', order.id)
  
  // This is a secondary confirmation, payment.captured is primary
  const { data: orders } = await supabase
    .from('gig_orders')
    .select('id, payment_status')
    .eq('razorpay_order_id', order.id)
    .single()
  
  if (orders && orders.payment_status !== 'captured') {
    await supabase
      .from('gig_orders')
      .update({
        payment_status: 'captured',
      })
      .eq('id', orders.id)
  }
}

async function handleRefund(supabase: any, event: any) {
  const refund = event.payload.refund.entity
  
  console.log('Refund processed:', refund.id)
  
  // Find order by payment ID
  const { data: orders } = await supabase
    .from('gig_orders')
    .select('id')
    .eq('razorpay_payment_id', refund.payment_id)
    .single()
  
  if (orders) {
    await supabase
      .from('gig_orders')
      .update({
        refund_id: refund.id,
        refund_amount: refund.amount,
        refund_status: 'processed',
        refunded_at: new Date(refund.created_at * 1000).toISOString(),
        payment_status: 'refunded',
        status: 'cancelled',
      })
      .eq('id', orders.id)
    
    console.log('Order refunded:', orders.id)
  }
}
