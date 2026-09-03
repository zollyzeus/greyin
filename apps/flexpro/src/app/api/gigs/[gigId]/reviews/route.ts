import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/gigs/[gigId]/reviews - Get all reviews for a gig
export async function GET(
  request: Request,
  { params }: { params: { gigId: string } }
) {
  try {
    const supabase = await createClient()
    const gigId = params.gigId

    // Get reviews with pagination
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    const { data: reviews, error, count } = await supabase
      .from('order_reviews')
      .select('*, reviewer:profiles!reviewer_id(full_name, avatar_url), order:gig_orders(package_type)', { count: 'exact' })
      .eq('gig_id', gigId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Failed to fetch reviews:', error)
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
    }

    return NextResponse.json({
      reviews: reviews || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })

  } catch (error) {
    console.error('Get reviews error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
