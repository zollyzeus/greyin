import { createClient } from '@/app/lib/supabase/server'
import { absoluteUrl } from '@/app/lib/site-url'
import { NextResponse } from 'next/server'

const FEED_VISIBILITY_VALUES = ['public', 'followers', 'private']

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: id } = await params
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

  // RLS (author-owned UPDATE policy) enforces this is the post's own
  // author -- no separate ownership check needed here. The dynamic
  // segment is named [slug] only to match the existing sibling route
  // /api/posts/[slug]/update (Next.js requires the same param name for
  // every dynamic segment at one path level) -- the value passed here
  // is still the post's real id, which the dashboard list already has
  // on hand, not its slug.
  await supabase.from('posts').update({ feed_visibility: feedVisibility }).eq('id', id)

  return NextResponse.redirect(absoluteUrl('/dashboard'))
}
