import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const keywords = (formData.get('keywords') as string || '').trim()
  const location = (formData.get('location') as string || '').trim()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/jobs'))
  }

  if (!keywords && !location) {
    return NextResponse.redirect(absoluteUrl('/jobs'))
  }

  await supabase.from('job_alerts').insert({
    user_id: user.id,
    keywords: keywords || null,
    location: location || null,
  })

  return NextResponse.redirect(absoluteUrl('/dashboard/alerts?success=1'))
}
