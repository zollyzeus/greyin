import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Ported from apps/stackworks/src/app/api/verified-outcomes/[id]/
// human-review/route.ts (Phase 3, pitch-readiness plan) -- admin-only
// path only (the original also serves an ask-owner review flow on
// StackWorks itself, unrelated to this tab, not ported here). Always
// redirects back to this Hub tab rather than the original's ask-relative
// fallback, since a StackWorks-relative path wouldn't resolve on Hub's
// own domain anyway.
const VERIFICATION_PASS_THRESHOLD = 70 // apps/stackworks/src/lib/verification.ts

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const { data: outcome } = await supabase
    .from('verified_outcomes')
    .select('id, status')
    .eq('id', id)
    .single()

  if (!outcome || outcome.status !== 'pending') {
    return NextResponse.redirect(absoluteUrl('/admin/stackworks'))
  }

  const score = Math.max(0, Math.min(100, parseInt(formData.get('human_score') as string, 10)))
  if (Number.isNaN(score)) {
    return NextResponse.redirect(absoluteUrl('/admin/stackworks'))
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

  return NextResponse.redirect(absoluteUrl('/admin/stackworks'))
}
