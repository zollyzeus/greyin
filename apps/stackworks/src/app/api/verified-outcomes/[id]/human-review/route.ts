import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { VERIFICATION_PASS_THRESHOLD } from '@/lib/verification'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: outcome } = await supabase
    .from('verified_outcomes')
    .select('id, status, project_applications:application_id ( ask_id )')
    .eq('id', id)
    .single()

  if (!outcome || outcome.status !== 'pending') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  // Reviewed from two different places -- the ask detail page (owner
  // reviewing a collaboration outcome) and the admin panel (admin
  // reviewing a self-submitted project_shipped outcome, which has no
  // ask/application to derive a redirect from) -- so the caller says
  // where to land, defaulting to the ask if there is one.
  const askId = (outcome.project_applications as unknown as { ask_id: string } | null)?.ask_id
  const redirectTo = (formData.get('redirect_to') as string) || (askId ? `/asks/${askId}` : '/dashboard')

  const score = Math.max(0, Math.min(100, parseInt(formData.get('human_score') as string, 10)))
  if (Number.isNaN(score)) {
    return NextResponse.redirect(absoluteUrl(redirectTo))
  }
  const notes = (formData.get('human_notes') as string || '').trim() || null

  // RLS (verified_outcomes UPDATE policy) already restricts this to the
  // ask/project owner or an admin, so no extra ownership check is needed
  // here -- an update from anyone else would silently affect zero rows.
  await supabase
    .from('verified_outcomes')
    .update({
      human_score: score,
      human_notes: notes,
      human_reviewed_by: user.id,
      human_reviewed_at: new Date().toISOString(),
      score,
      status: score >= VERIFICATION_PASS_THRESHOLD ? 'verified' : 'rejected',
      verification_method: 'human_reviewed',
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.redirect(absoluteUrl(redirectTo))
}
