import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/wishlist'))
  }

  const title = (formData.get('title') as string || '').trim()
  const description = (formData.get('description') as string || '').trim() || null
  if (!title) {
    return NextResponse.redirect(absoluteUrl('/wishlist?error=' + encodeURIComponent('A title is required.')))
  }

  const { error } = await supabase.from('feature_requests').insert({ user_id: user.id, title, description })
  if (error) {
    return NextResponse.redirect(absoluteUrl('/wishlist?error=' + encodeURIComponent('Could not submit your suggestion. Please try again.')))
  }

  return NextResponse.redirect(absoluteUrl('/wishlist'))
}
