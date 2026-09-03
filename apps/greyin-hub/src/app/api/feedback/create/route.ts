import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/feedback'))
  }

  const message = (formData.get('message') as string || '').trim()
  const sourceApp = (formData.get('source_app') as string || '').trim() || null
  const ratingRaw = formData.get('rating') as string
  const rating = ratingRaw ? parseInt(ratingRaw, 10) : null

  if (!message) {
    return NextResponse.redirect(absoluteUrl('/feedback?error=' + encodeURIComponent('Please write your feedback.')))
  }

  const { error } = await supabase.from('platform_feedback').insert({
    user_id: user.id,
    message,
    source_app: sourceApp,
    rating: rating && rating >= 1 && rating <= 5 ? rating : null,
  })
  if (error) {
    return NextResponse.redirect(absoluteUrl('/feedback?error=' + encodeURIComponent('Could not send your feedback. Please try again.')))
  }

  return NextResponse.redirect(absoluteUrl('/feedback?success=1'))
}
