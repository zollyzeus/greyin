import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  // Same Verified Expert gate as the pivot tag and mentor availability --
  // keeps this as "senior, with a gap in the timeline" rather than a
  // backdoor around the candidacy gate.
  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('is_verified_expert')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!scoreRow?.is_verified_expert) {
    return NextResponse.redirect(
      absoluteUrl(`/profile?error=${encodeURIComponent('Verified Expert status is required to set a career re-entry status.')}`)
    )
  }

  const formData = await request.formData()
  const isReentry = formData.get('is_reentry') === 'on'
  const reentryReasonRaw = formData.get('reentry_reason') as string
  const reentryReason = ['caregiving', 'health', 'layoff', 'sabbatical', 'relocation', 'other'].includes(reentryReasonRaw)
    ? reentryReasonRaw
    : null
  const reentryNote = ((formData.get('reentry_note') as string) || '').trim() || null

  const { error } = await supabase
    .from('profiles')
    .update({
      is_reentry: isReentry,
      reentry_reason: isReentry ? reentryReason : null,
      reentry_note: isReentry ? reentryNote : null,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Re-entry status update failed:', error)
    return NextResponse.redirect(
      absoluteUrl(`/profile?error=${encodeURIComponent('Could not save your re-entry status.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl('/profile?success=1'))
}
