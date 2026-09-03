import { createClient } from '@/app/lib/supabase/server'
import { absoluteUrl } from '@/app/lib/site-url'
import { sweepUnscoredPosts } from '@/app/lib/post-quality'
import { NextResponse } from 'next/server'

// Manual trigger for the same catch-up sweepUnscoredPosts() already runs
// on every /dashboard visit -- an admin action for when someone wants to
// clear the backlog right now instead of waiting for a dashboard visit
// or the next periodic tick (see src/instrumentation.ts). Higher limit
// than the page-visit sweep since this is a deliberate action the admin
// is already waiting on, not a side effect of loading an unrelated page.
export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const { swept, remaining } = await sweepUnscoredPosts(10)

  return NextResponse.redirect(absoluteUrl(`/admin?swept=${swept}&remaining=${remaining}`))
}
