import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

/**
 * AI enhancement (Phase D2, "11 new AI enhancements" plan) -- toggles
 * the opt-in shareable Verified Score badge (133_public_score_badges.sql).
 * Slug is generated once on first enable and kept stable across later
 * toggles -- disabling just flips enabled=false (the row and slug stay,
 * so re-enabling later doesn't hand out a new URL); there's no reset/
 * regenerate action here, matching the plan's own minimal scope.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const enabled = formData.get('enabled') === 'on'

  const { data: existing } = await supabase
    .from('public_score_badges')
    .select('slug')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('public_score_badges')
      .update({ enabled })
      .eq('user_id', user.id)
    if (error) {
      console.error('Verified Score badge toggle failed:', error)
      return NextResponse.redirect(
        absoluteUrl(`/profile?error=${encodeURIComponent('Could not update your badge.')}`)
      )
    }
  } else if (enabled) {
    // Service client for the insert -- the row's own RLS policy already
    // requires auth.uid() = user_id via the anon-key client too, but a
    // fresh insert (no existing row yet) is the one path worth being
    // extra deliberate about, since it's also the one place a slug
    // collision could plausibly need a retry.
    const service = createServiceClient()
    let inserted = false
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const slug = randomBytes(6).toString('hex')
      const { error } = await service
        .from('public_score_badges')
        .insert({ user_id: user.id, slug, enabled: true })
      if (!error) inserted = true
      else if (error.code !== '23505') {
        console.error('Verified Score badge creation failed:', error)
        return NextResponse.redirect(
          absoluteUrl(`/profile?error=${encodeURIComponent('Could not create your badge.')}`)
        )
      }
    }
    if (!inserted) {
      return NextResponse.redirect(
        absoluteUrl(`/profile?error=${encodeURIComponent('Could not create your badge, please try again.')}`)
      )
    }
  }

  return NextResponse.redirect(absoluteUrl('/profile?success=1'))
}
