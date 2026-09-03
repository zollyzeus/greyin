import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { absoluteUrl } from '@/lib/site-url'
import { runAIVerification } from '@/lib/verification'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: application } = await supabase
    .from('project_applications')
    .select(
      'id, ask_id, applicant_id, status, project_asks:ask_id ( id, role_title, description, verification_criteria, project_id, builder_projects:project_id ( id, title, description ) )'
    )
    .eq('id', id)
    .single()

  if (!application || application.applicant_id !== user.id || application.status !== 'accepted') {
    return NextResponse.redirect(absoluteUrl('/applications'))
  }

  const summary = (formData.get('summary') as string || '').trim()
  if (!summary) {
    return NextResponse.redirect(absoluteUrl(`/asks/${application.ask_id}`))
  }
  const evidenceUrl = (formData.get('evidence_url') as string || '').trim() || null

  const ask = application.project_asks as unknown as {
    role_title: string
    description: string | null
    verification_criteria: string | null
    project_id: string
    builder_projects: { id: string; title: string; description: string | null } | null
  } | null
  const project = ask?.builder_projects || null

  // Self-submit is allowed by RLS (subject_user_id = auth.uid()); this
  // uses the user's own session, not the service client below.
  const { data: outcome } = await supabase
    .from('verified_outcomes')
    .insert({
      subject_user_id: user.id,
      project_id: project?.id || null,
      application_id: application.id,
      outcome_type: 'collaboration_completed',
      evidence_url: evidenceUrl,
      notes: summary,
    })
    .select('id')
    .single()

  if (outcome) {
    const aiResult = await runAIVerification({
      projectTitle: project?.title || '',
      projectDescription: project?.description || null,
      askRoleTitle: ask?.role_title || '',
      askDescription: ask?.description || null,
      verificationCriteria: ask?.verification_criteria || null,
      submittedSummary: summary,
      evidenceUrl,
    })

    // The applicant doesn't own the ask, so RLS wouldn't let their own
    // session write ai_* here -- this is exactly the kind of privileged,
    // route-validated write createServiceClient() exists for. Ownership
    // of *which* row gets written was already established above (the
    // applicant just inserted it).
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

  return NextResponse.redirect(absoluteUrl(`/asks/${application.ask_id}`))
}
