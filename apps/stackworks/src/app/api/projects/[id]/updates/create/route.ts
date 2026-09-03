import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const FEED_VISIBILITY_VALUES = ['public', 'followers', 'private']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/projects/${id}`))
  }

  const body = (formData.get('body') as string || '').trim()
  const feedVisibilityRaw = formData.get('feed_visibility') as string
  const feedVisibility = FEED_VISIBILITY_VALUES.includes(feedVisibilityRaw) ? feedVisibilityRaw : 'public'
  if (body) {
    // RLS (project_updates INSERT policy) restricts this to the project
    // owner -- a non-owner's insert would be rejected outright, not just
    // silently no-op, since INSERT has no matching row to filter against.
    await supabase.from('project_updates').insert({
      project_id: id,
      author_id: user.id,
      body,
      feed_visibility: feedVisibility,
    })
  }

  return NextResponse.redirect(absoluteUrl(`/projects/${id}`))
}
