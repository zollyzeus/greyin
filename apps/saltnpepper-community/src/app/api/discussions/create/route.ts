import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { checkModeration } from '@/lib/moderation'
import { NextResponse } from 'next/server'

const FEED_VISIBILITY_VALUES = ['public', 'followers', 'private']

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/discussions/new'))
  }

  const title = (formData.get('title') as string || '').trim()
  const body = (formData.get('body') as string || '').trim()
  const category = formData.get('category') as string
  const isAnonymous = formData.get('is_anonymous') === 'true'
  const feedVisibilityRaw = formData.get('feed_visibility') as string
  const feedVisibility = FEED_VISIBILITY_VALUES.includes(feedVisibilityRaw) ? feedVisibilityRaw : 'public'

  if (!title || !body) {
    return NextResponse.redirect(absoluteUrl('/discussions/new'))
  }

  // Pre-publish moderation gate (098) -- fail-open on 'unavailable' (post
  // goes live, queued via moderation_status for automatic retry), but a
  // live BLOCK verdict stops the post before it's ever inserted.
  const moderation = await checkModeration({ title, body })
  if (moderation.outcome === 'block') {
    return NextResponse.redirect(
      absoluteUrl('/discussions/new?error=' + encodeURIComponent(moderation.reason || 'This post was not allowed. Please revise and try again.'))
    )
  }

  const { data: discussion, error } = await supabase
    .from('discussions')
    .insert({
      author_id: user.id,
      title,
      body,
      category,
      is_anonymous: isAnonymous,
      feed_visibility: feedVisibility,
      moderation_status: moderation.outcome === 'unavailable' ? 'pending_check' : 'passed',
    })
    .select('id')
    .single()

  if (error || !discussion) {
    return NextResponse.redirect(
      absoluteUrl('/discussions/new?error=' + encodeURIComponent('Could not post the discussion. Please try again.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/discussions/${discussion.id}`))
}
