import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { checkModeration } from '@/lib/moderation'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/discussions/${id}`))
  }

  const body = (formData.get('body') as string || '').trim()
  const isAnonymous = formData.get('is_anonymous') === 'true'
  if (body) {
    // Pre-publish moderation gate (098) -- same fail-open/block rules as
    // discussions/create, see moderation.ts.
    const moderation = await checkModeration({ body })
    if (moderation.outcome === 'block') {
      return NextResponse.redirect(
        absoluteUrl(`/discussions/${id}?error=` + encodeURIComponent(moderation.reason || 'This reply was not allowed. Please revise and try again.'))
      )
    }

    const { error } = await supabase.from('discussion_replies').insert({
      discussion_id: id,
      author_id: user.id,
      body,
      is_anonymous: isAnonymous,
      moderation_status: moderation.outcome === 'unavailable' ? 'pending_check' : 'passed',
    })
    if (error) {
      return NextResponse.redirect(
        absoluteUrl(`/discussions/${id}?error=` + encodeURIComponent('Could not post your reply. Please try again.'))
      )
    }
  }

  return NextResponse.redirect(absoluteUrl(`/discussions/${id}`))
}
