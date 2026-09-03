import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/gigs/new'))
  }

  // RLS's own "An active subscriber can post a gig listing" policy
  // (094) is the real enforcement -- this check exists only so an
  // unsubscribed user gets a clean redirect to /subscribe instead of a
  // silent 0-row insert failure.
  const { data: subscription } = await supabase
    .from('flexpro_subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (subscription?.status !== 'active') {
    return NextResponse.redirect(absoluteUrl('/subscribe'))
  }

  // 096: the tier itself carries a monthly gig/job-post credit
  // allowance -- consume_credit() is the real check (SECURITY DEFINER,
  // atomic check-and-increment against credit_usage); an active
  // subscription alone no longer guarantees an unmetered post.
  const { data: canPost } = await supabase.rpc('consume_credit', {
    p_user_id: user.id,
    p_product: 'flexpro_posting',
    p_credit_type: 'gig_post',
  })
  if (!canPost) {
    return NextResponse.redirect(
      absoluteUrl('/subscribe?error=' + encodeURIComponent('You have used all your gig/job posting credits for this billing period. Upgrade your tier to post more.'))
    )
  }

  const title = (formData.get('title') as string || '').trim()
  const description = (formData.get('description') as string || '').trim()
  if (!title || !description) {
    return NextResponse.redirect(absoluteUrl('/gigs/new'))
  }

  const tagsRaw = formData.get('tags') as string
  const tags = tagsRaw ? tagsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const imageUrl = (formData.get('image_url') as string || '').trim()
  const feedVisibilityRaw = formData.get('feed_visibility') as string
  const feedVisibility = ['public', 'followers', 'private'].includes(feedVisibilityRaw) ? feedVisibilityRaw : 'public'

  const { data: gig, error } = await supabase
    .from('gigs')
    .insert({
      freelancer_id: user.id,
      title,
      slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 8)}`,
      description,
      category_id: (formData.get('category_id') as string) || null,
      price_min: formData.get('price_min') ? parseInt(formData.get('price_min') as string, 10) : null,
      price_max: formData.get('price_max') ? parseInt(formData.get('price_max') as string, 10) : null,
      delivery_days: formData.get('delivery_days') ? parseInt(formData.get('delivery_days') as string, 10) : null,
      tags,
      images: imageUrl ? [imageUrl] : [],
      status: 'active',
      feed_visibility: feedVisibility,
    })
    .select('id')
    .single()

  if (error || !gig) {
    return NextResponse.redirect(
      absoluteUrl('/gigs/new?error=' + encodeURIComponent('Could not publish the gig. Please try again.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/gigs/${gig.id}`))
}
