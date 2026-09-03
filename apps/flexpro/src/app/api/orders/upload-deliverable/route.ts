import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { absoluteUrl } from '@/lib/site-url'
import { sendDeliverableUploadedEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(absoluteUrl('/login'), 303)
    }

    const formData = await request.formData()
    const orderId = formData.get('orderId') as string
    const file = formData.get('file') as File
    const notes = formData.get('notes') as string || ''

    if (!orderId || !file) {
      return NextResponse.redirect(absoluteUrl(orderId ? `/orders/${orderId}` : '/orders'), 303)
    }

    // Get order details with buyer and seller info
    const { data: order } = await supabase
      .from('gig_orders')
      .select('*, gig:gigs(title), buyer:profiles!buyer_id(full_name, email), seller:profiles!seller_id(full_name, email)')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.redirect(absoluteUrl('/orders'), 303)
    }

    // Only seller can upload deliverables
    if (order.seller_id !== user.id) {
      return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`), 303)
    }

    // Upload file to Supabase Storage
    const fileName = `${orderId}/${Date.now()}_${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('deliverables')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('File upload failed:', uploadError)
      return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`), 303)
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('deliverables')
      .getPublicUrl(fileName)

    // Get existing deliverables
    const existingDeliverables = order.deliverables || []

    // Add new deliverable
    const newDeliverable = {
      name: file.name,
      url: publicUrl,
      notes: notes,
      uploaded_at: new Date().toISOString(),
    }

    // Update order with new deliverable and mark as delivered
    const { data: updatedOrder, error: updateError } = await supabase
      .from('gig_orders')
      .update({
        deliverables: [...existingDeliverables, newDeliverable],
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single()

    if (updateError) {
      console.error('Order update failed:', updateError)
      return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`), 303)
    }

    // Send notification email to buyer
    console.log(`Deliverable uploaded for order ${orderId}`)
    
    if (order.buyer?.email) {
      const deliverableCount = (order.deliverables || []).length + 1
      await sendDeliverableUploadedEmail({
        buyerEmail: order.buyer.email,
        buyerName: order.buyer.full_name || 'Customer',
        orderId: order.id,
        gigTitle: order.gig?.title || 'Service',
        sellerName: order.seller?.full_name || 'Seller',
        deliverableCount,
      })
    }

    return NextResponse.redirect(absoluteUrl(`/orders/${orderId}`), 303)

  } catch (error) {
    console.error('Deliverable upload error:', error)
    return NextResponse.redirect(absoluteUrl('/orders'), 303)
  }
}
