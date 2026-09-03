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
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  // RLS ("Project owners can update their own project updates", added by
  // 053_activity_feed.sql) enforces this is the update's own author -- no
  // separate ownership check needed here.
  await supabase.from('project_updates').update({ feed_visibility: feedVisibility }).eq('id', id)

  return NextResponse.redirect(absoluteUrl('/dashboard'))
}
