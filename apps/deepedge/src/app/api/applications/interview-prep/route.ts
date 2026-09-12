import { createClient } from '@/lib/supabase/server'
import { generateInterviewQuestions } from '@/lib/interview-prep'
import { NextResponse } from 'next/server'

// Takes only an application_id, not client-supplied job/candidate data --
// everything is looked up server-side scoped to the requesting user's own
// application (RLS-enforced via the request-scoped client), so a
// candidate can't spoof prep questions for someone else's application.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { application_id } = await request.json().catch(() => ({}))
  if (!application_id) {
    return NextResponse.json({ error: 'application_id is required' }, { status: 400 })
  }

  const { data: application } = await supabase
    .from('applications')
    .select('status, candidates ( current_title, skills, experience_years ), jobs ( title, description, skills_required, company_id )')
    .eq('id', application_id)
    .single()

  if (!application || application.status !== 'interview') {
    return NextResponse.json({ error: 'This application is not at the interview stage.' }, { status: 400 })
  }

  const candidate = application.candidates as unknown as { current_title: string | null; skills: string[]; experience_years: number | null } | null
  const job = application.jobs as unknown as { title: string; description: string; skills_required: string[]; company_id: string } | null
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Crowdsourced real questions for this company (151) -- most recent 15,
  // grounding the AI prep in real reported experience instead of purely
  // generic output. Readable by any authenticated user per that table's
  // own RLS, so this plain select needs no service-role escalation.
  const { data: realQuestionRows } = await supabase
    .from('interview_question_logs')
    .select('question_text')
    .eq('company_id', job.company_id)
    .order('created_at', { ascending: false })
    .limit(15)

  const questions = await generateInterviewQuestions(
    {
      current_title: candidate?.current_title ?? null,
      skills: candidate?.skills ?? [],
      experience_years: candidate?.experience_years ?? null,
    },
    { title: job.title, description: job.description, skillsRequired: job.skills_required || [] },
    (realQuestionRows || []).map((r) => r.question_text)
  )

  if (!questions) {
    return NextResponse.json({ error: 'AI suggestions are unavailable right now. Try again shortly.' }, { status: 503 })
  }

  return NextResponse.json({ questions })
}
