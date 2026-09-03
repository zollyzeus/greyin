import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Sign in to tip an author' }, { status: 401 })
    }

    const { postId, amount } = await request.json()
    if (!postId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Missing postId or amount' }, { status: 400 })
    }

    const { data: post } = await supabase.from('posts').select('author_id, title').eq('id', postId).single()
    if (!post?.author_id) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        // Razorpay caps receipt at 40 chars — this session already found
        // that gap the hard way once for FlexPro (a full uuid postId
        // blew past it), so this stays short from the start.
        receipt: `tip_${postId.slice(0, 8)}_${Date.now()}`,
        notes: { post_id: postId, tipper_id: user.id },
      }),
    })

    if (!razorpayResponse.ok) {
      const error = await razorpayResponse.json()
      console.error('Razorpay tip order creation failed:', error)
      return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
    }

    const razorpayOrder = await razorpayResponse.json()

    const { data: tip, error: tipError } = await supabase
      .from('author_tips')
      .insert({
        post_id: postId,
        author_id: post.author_id,
        tipper_id: user.id,
        tipper_email: user.email,
        amount,
        razorpay_order_id: razorpayOrder.id,
      })
      .select('id')
      .single()

    if (tipError || !tip) {
      console.error('Tip record creation failed:', tipError)
      return NextResponse.json({ error: 'Failed to record tip' }, { status: 500 })
    }

    return NextResponse.json({
      tipId: tip.id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: RAZORPAY_KEY_ID,
    })
  } catch (error) {
    console.error('Tip creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
