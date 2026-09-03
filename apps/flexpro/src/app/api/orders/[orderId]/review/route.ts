import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { runDeliveryQualityCheck } from '@/lib/delivery-quality'
import { NextResponse } from 'next/server'

// POST /api/orders/[orderId]/review - Submit or update a review
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
    const { rating, reviewText, response } = await request.json()

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    // Get order details
    const { data: order } = await supabase
      .from('gig_orders')
      .select('*, gig:gigs(id, title, category:gig_categories(name))')
      .eq('id', orderId)
      .single()

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if order is completed
    if (order.status !== 'completed') {
      return NextResponse.json({ error: 'Can only review completed orders' }, { status: 400 })
    }

    const isBuyer = order.buyer_id === user.id
    const isSeller = order.seller_id === user.id

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Buyer submitting review
    if (isBuyer && rating) {
      // Check if review already exists
      const { data: existingReview } = await supabase
        .from('order_reviews')
        .select('id')
        .eq('order_id', orderId)
        .single()

      if (existingReview) {
        // Update existing review
        const { data: updatedReview, error } = await supabase
          .from('order_reviews')
          .update({
            rating,
            review_text: reviewText,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingReview.id)
          .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url)')
          .single()

        if (error) {
          console.error('Failed to update review:', error)
          return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
        }

        return NextResponse.json({ review: updatedReview })
      } else {
        // Create new review
        const { data: newReview, error } = await supabase
          .from('order_reviews')
          .insert({
            order_id: orderId,
            gig_id: order.gig.id,
            reviewer_id: user.id,
            reviewee_id: order.seller_id,
            rating,
            review_text: reviewText,
          })
          .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url)')
          .single()

        if (error) {
          console.error('Failed to create review:', error)
          return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
        }

        // AI-rated delivery quality (048_ai_quality_scores.sql) --
        // additive/informational only, does not feed greyin_score.
        // Hooked here rather than the order's completed transition
        // because order_reviews can only be inserted once status is
        // already 'completed' (RLS), so this is the one point where
        // the delivery content and the buyer's own feedback both exist.
        // Score-once, matching verified_outcomes.ai_score's "set once"
        // philosophy -- editing a review doesn't change what was
        // actually delivered.
        const quality = await runDeliveryQualityCheck({
          gigTitle: order.gig?.title || '',
          gigCategory: order.gig?.category?.name || null,
          requirements: order.requirements,
          deliveryMessage: order.delivery_message,
          buyerRating: rating,
          buyerReviewText: reviewText || null,
        })
        if (quality) {
          const service = createServiceClient()
          await service.from('ai_quality_scores').insert({
            subject_user_id: order.seller_id,
            content_type: 'flexpro_delivery',
            gig_order_id: orderId,
            score: quality.score,
            notes: quality.notes,
            provider: quality.provider,
            scored_at: new Date().toISOString(),
          })
        }

        return NextResponse.json({ review: newReview })
      }
    }

    // Seller responding to review
    if (isSeller && response) {
      const { data: updatedReview, error } = await supabase
        .from('order_reviews')
        .update({
          response,
          response_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)
        .select('*')
        .single()

      if (error) {
        console.error('Failed to add response:', error)
        return NextResponse.json({ error: 'Failed to add response' }, { status: 500 })
      }

      return NextResponse.json({ review: updatedReview })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  } catch (error) {
    console.error('Review submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/orders/[orderId]/review - Get review for an order
export async function GET(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId

    // Plain stateless fetch, not the cookie-bound SSR client -- reviews are
    // public data ("Reviews are publicly viewable"), no session is needed,
    // and this being the first Supabase call on a fresh client with no
    // preceding .auth.* call was found to risk the @supabase/ssr
    // session-recovery crash the auth signup routes had. The
    // vnd.pgrst.object+json Accept header reproduces .single()'s behavior
    // (a single object, PGRST116 on 0/multiple rows).
    const reviewRes = await fetch(
      `${process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/order_reviews?order_id=eq.${orderId}&select=*,reviewer:profiles!reviewer_id(full_name,avatar_url),reviewee:profiles!reviewee_id(full_name,avatar_url)`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          Accept: 'application/vnd.pgrst.object+json',
        },
      }
    )

    if (!reviewRes.ok && reviewRes.status !== 406) { // 406 (PGRST116) is "not found"
      console.error('Failed to fetch review:', await reviewRes.text())
      return NextResponse.json({ error: 'Failed to fetch review' }, { status: 500 })
    }

    const review = reviewRes.ok ? await reviewRes.json() : null

    return NextResponse.json({ review: review || null })

  } catch (error) {
    console.error('Get review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
