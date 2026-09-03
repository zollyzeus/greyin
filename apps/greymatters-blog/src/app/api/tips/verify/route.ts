import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tipId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = await request.json()

    const shasum = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET!)
    shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`)
    const digest = shasum.digest('hex')

    if (digest !== razorpaySignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const { error } = await supabase
      .from('author_tips')
      .update({ status: 'paid', razorpay_payment_id: razorpayPaymentId })
      .eq('id', tipId)
      .eq('tipper_id', user.id)

    if (error) {
      console.error('Tip verification update failed:', error)
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tip verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
