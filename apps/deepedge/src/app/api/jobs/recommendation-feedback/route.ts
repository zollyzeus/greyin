import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_TYPE = ['profile', 'history', 'preferences', 'top_candidate']
const VALID_FEEDBACK = ['helpful', 'not_relevant', 'already_applied', 'wrong_fit']

/**
 * JSON API, not a form POST -- called from RecommendationFeedback.tsx's
 * client-side fetch so giving feedback never navigates the candidate
 * away from the /jobs listing they're browsing. Upserts on (user_id,
 * job_id): a second click on the same job's feedback updates rather
 * than stacking a duplicate opinion.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const jobId = body?.job_id
  const recommendationType = body?.recommendation_type
  const feedback = body?.feedback
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 280) || null : null

  if (typeof jobId !== 'string' || !VALID_TYPE.includes(recommendationType) || !VALID_FEEDBACK.includes(feedback)) {
    return NextResponse.json({ ok: false, error: 'Invalid feedback payload' }, { status: 400 })
  }

  const { error } = await supabase.from('job_recommendation_feedback').upsert(
    {
      user_id: user.id,
      job_id: jobId,
      recommendation_type: recommendationType,
      feedback,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,job_id' }
  )

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
