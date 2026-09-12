import { createClient } from '@/app/lib/supabase/server'
import { absoluteUrl } from '@/app/lib/site-url'
import { NextResponse } from 'next/server'

// Only 'greymatters_comment' is reportable from this app (152). Reporting
// also soft-hides the comment immediately (submit_content_report sets its
// status to 'pending', which its own RLS policy already excludes from
// public view) -- reversible by an admin clearing the report.
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

  return NextResponse.redirect(absoluteUrl(`${returnTo}?reported=1#comments`))
}
