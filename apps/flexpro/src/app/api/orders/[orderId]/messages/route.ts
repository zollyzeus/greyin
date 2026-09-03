import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/orders/[orderId]/messages - Get all messages for an order
export async function GET(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = params.orderId

    // Verify user is part of this order
    const { data: order } = await supabase
      .from('gig_orders')
      .select('buyer_id, seller_id')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get all messages for this order
    const { data: messages, error } = await supabase
      .from('order_messages')
      .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Mark messages as read for the current user
    const unreadMessageIds = messages
      .filter(msg => msg.sender_id !== user.id && !msg.read_at)
      .map(msg => msg.id)

    if (unreadMessageIds.length > 0) {
      await supabase
        .from('order_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadMessageIds)
    }

    return NextResponse.json({ messages })

  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/orders/[orderId]/messages - Send a new message
export async function POST(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderId = params.orderId
    const { message, attachments = [] } = await request.json()

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    // Verify user is part of this order
    const { data: order } = await supabase
      .from('gig_orders')
      .select('buyer_id, seller_id')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Insert message
    const { data: newMessage, error } = await supabase
      .from('order_messages')
      .insert({
        order_id: orderId,
        sender_id: user.id,
        message: message.trim(),
        attachments: attachments,
      })
      .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
      .single()

    if (error) {
      console.error('Failed to send message:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ message: newMessage })

  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
