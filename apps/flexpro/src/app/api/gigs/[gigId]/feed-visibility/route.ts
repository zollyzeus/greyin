import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const FEED_VISIBILITY_VALUES = ['public', 'followers', 'private']

export async function POST(request: Request, { params }: { params: { gigId: string } }) {
  const { gigId: id } = params
  const supabase = await createClient()
  const formData = await request.formData()
  const feedVisibility = formData.get('feed_visibility') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  if (!FEED_VISIBILITY_VALUES.includes(feedVisibility)) {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  // RLS (author-owned UPDATE policy on gigs) enforces this is the gig's
  // own freelancer -- no separate ownership check needed here.
  await supabase.from('gigs').update({ feed_visibility: feedVisibility }).eq('id', id)

  return NextResponse.redirect(absoluteUrl('/dashboard'))
}
