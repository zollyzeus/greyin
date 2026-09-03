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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const title = (formData.get('title') as string || '').trim()
  const description = (formData.get('description') as string || '').trim()
  const isFree = formData.get('is_free') === 'true'
  const priceRaw = formData.get('price') as string
  const price = isFree ? 0 : parseInt(priceRaw, 10) || 0

  if (!title || !description) {
    return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage?error=' + encodeURIComponent('Title and description are required.')))
  }

  const { data: gig, error } = await supabase
    .from('gigs')
    .insert({
      freelancer_id: user.id,
      title,
      slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 8)}`,
      description,
      pricing_type: 'fixed',
      price_min: price,
      price_max: price,
      delivery_days: 1,
      status: 'active',
      is_mentor_session: true,
      // Deliberately no tags here -- tags is what skill_ratings
      // (054_skill_endorsements_and_ratings.sql) treats as "the skills
      // this gig can be rated on," which doesn't apply to a mentor
      // session. Each session's actual length comes from the mentor's
      // own start/end time on each slot, not a gig-level field.
    })
    .select('id')
    .single()

  if (error || !gig) {
    return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage?error=' + encodeURIComponent('Could not create session type.')))
  }

  return NextResponse.redirect(absoluteUrl('/mentor-sessions/manage'))
}
