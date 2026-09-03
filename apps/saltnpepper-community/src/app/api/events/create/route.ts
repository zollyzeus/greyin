import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/events/new'))
  }

  const title = (formData.get('title') as string || '').trim()
  const description = (formData.get('description') as string || '').trim()
  const startsAtRaw = formData.get('starts_at') as string
  const endsAtRaw = formData.get('ends_at') as string
  const isVirtual = formData.get('is_virtual') === 'true'
  const location = (formData.get('location') as string || '').trim() || null
  const capacityRaw = formData.get('capacity') as string
  const capacity = capacityRaw ? parseInt(capacityRaw, 10) : null

  if (!title || !description || !startsAtRaw) {
    return NextResponse.redirect(absoluteUrl('/events/new?error=' + encodeURIComponent('Title, description, and start time are required.')))
  }

  const startsAt = new Date(startsAtRaw)
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
    return NextResponse.redirect(absoluteUrl('/events/new?error=' + encodeURIComponent('Start time must be a valid time in the future.')))
  }
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      host_id: user.id,
      title,
      description,
      location,
      is_virtual: isVirtual,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt.toISOString() : null,
      capacity: capacity && capacity > 0 ? capacity : null,
    })
    .select('id')
    .single()

  if (error || !event) {
    return NextResponse.redirect(absoluteUrl('/events/new?error=' + encodeURIComponent('Could not publish the event. Please try again.')))
  }

  return NextResponse.redirect(absoluteUrl(`/events/${event.id}`))
}
