import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// The reverse direction FreeAgent never had: an expert posts a need
// instead of a gig listing, other members apply. RLS's own "An active
// subscriber can post a client job" policy (093) is the real
// enforcement -- the check below just gives an unsubscribed user a
// clean redirect instead of a silent insert failure, same convention
// as api/gigs/create.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/client-jobs/new'))
  }

  const { data: subscription } = await supabase
    .from('flexpro_subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (subscription?.status !== 'active') {
    return NextResponse.redirect(absoluteUrl('/subscribe'))
  }

  // 096: client jobs share the same 'gig_post' credit pool as gig
  // listings (one posting-credit allowance covers "posting" in either
  // direction, matching the unified-subscription decision) -- see
  // api/gigs/create for the identical check.
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

  const formData = await request.formData()
  const title = (formData.get('title') as string || '').trim()
  const description = (formData.get('description') as string || '').trim()
  const budgetAmount = formData.get('budget_amount') ? parseInt(formData.get('budget_amount') as string, 10) : null
  if (!title || !description) {
    return NextResponse.redirect(absoluteUrl('/client-jobs/new'))
  }

  const { data: job, error } = await supabase
    .from('client_jobs')
    .insert({ client_id: user.id, title, description, budget_amount: budgetAmount })
    .select('id')
    .single()

  if (error || !job) {
    return NextResponse.redirect(
      absoluteUrl('/client-jobs/new?error=' + encodeURIComponent('Could not post the job. Please try again.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/client-jobs/${job.id}`))
}
