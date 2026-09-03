import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { absoluteUrl } from '@/lib/site-url'
import { runAIVerification } from '@/lib/verification'
import { NextResponse } from 'next/server'

/**
 * Builder self-verifies their own shipped project (outcome_type
 * 'project_shipped', no application_id) -- the counterpart to
 * applications/[id]/submit-outcome's collaboration path. Human review
 * here is admin-only by design (031's RLS excludes the subject from
 * reviewing their own outcome), since letting an owner review their own
 * submission would defeat the point of "verified".
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: project } = await supabase
    .from('builder_projects')
    .select('id, title, description, user_id')
    .eq('id', id)
    .single()

  if (!project || project.user_id !== user.id) {
    return NextResponse.redirect(absoluteUrl(`/projects/${id}`))
  }

  const summary = (formData.get('summary') as string || '').trim()
  if (!summary) {
    return NextResponse.redirect(absoluteUrl(`/projects/${id}`))
  }
  const evidenceUrl = (formData.get('evidence_url') as string || '').trim() || null

  const { data: outcome } = await supabase
    .from('verified_outcomes')
    .insert({
      subject_user_id: user.id,
      project_id: project.id,
      outcome_type: 'project_shipped',
      evidence_url: evidenceUrl,
      notes: summary,
    })
    .select('id')
    .single()

  if (outcome) {
    const aiResult = await runAIVerification({
      projectTitle: project.title,
      projectDescription: project.description,
      askRoleTitle: 'Project completion',
      askDescription: null,
      verificationCriteria: null,
      submittedSummary: summary,
      evidenceUrl,
    })

    // Same reasoning as applications/[id]/submit-outcome: the submitter
    // (project owner) can't write ai_* under RLS since 033 excludes
    // self-review, so this privileged write goes through the service
    // client instead.
    const service = createServiceClient()
    if (aiResult) {
      await service
        .from('verified_outcomes')
        .update({
          ai_score: aiResult.score,
          ai_notes: aiResult.notes,
          ai_verified_at: new Date().toISOString(),
          ai_provider: aiResult.provider,
          verification_method: 'ai_reviewed',
        })
        .eq('id', outcome.id)
    } else {
      await service
        .from('verified_outcomes')
        .update({ verification_method: 'pending_manual' })
        .eq('id', outcome.id)
    }
  }

  return NextResponse.redirect(absoluteUrl(`/projects/${id}`))
}
