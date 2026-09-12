import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Only 'direct_message' is reportable from this app (152) -- Salt &
// Pepper's own discussions/replies already go through a real pre-publish
// moderation LLM gate instead, see lib/moderation.ts.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const contentType = formData.get('content_type') as string
  const contentId = formData.get('content_id') as string
  const reason = (formData.get('reason') as string || '').trim()
  const returnTo = (formData.get('return_to') as string) || '/'

  if (!reason) {
    return NextResponse.redirect(absoluteUrl(`${returnTo}?report_error=${encodeURIComponent('Enter a reason for the report.')}`))
  }

  const { error } = await supabase.rpc('submit_content_report', {
    p_content_type: contentType,
    p_content_id: contentId,
    p_reason: reason,
  })

  if (error) {
    return NextResponse.redirect(absoluteUrl(`${returnTo}?report_error=${encodeURIComponent('Could not submit the report. Please try again.')}`))
  }

  return NextResponse.redirect(absoluteUrl(`${returnTo}?reported=1`))
}
