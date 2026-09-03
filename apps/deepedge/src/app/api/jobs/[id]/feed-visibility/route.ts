import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const FEED_VISIBILITY_VALUES = ['public', 'followers', 'private']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()
  const feedVisibility = formData.get('feed_visibility') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  if (!FEED_VISIBILITY_VALUES.includes(feedVisibility)) {
    return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
  }

  // RLS (existing company-owner FOR ALL policy on jobs) enforces this is
  // the job's own company owner -- no separate ownership check needed here.
  await supabase.from('jobs').update({ feed_visibility: feedVisibility }).eq('id', id)

  return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
}
