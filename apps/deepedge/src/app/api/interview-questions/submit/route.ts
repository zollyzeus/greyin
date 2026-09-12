import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// interview_question_logs' own INSERT policy (151) is the real
// enforcement -- a candidate can only submit for a company they have a
// real application against that reached at least the interview stage.
// This route just gives a friendly redirect either way.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const companyId = formData.get('company_id') as string
  const questionText = (formData.get('question_text') as string || '').trim()
  const roundLabel = (formData.get('round_label') as string || '').trim() || null

  if (!companyId || !questionText) {
    return NextResponse.redirect(
      absoluteUrl('/dashboard/applications?question_error=' + encodeURIComponent('Enter a question to share.'))
    )
  }

  const { error } = await supabase.from('interview_question_logs').insert({
    company_id: companyId,
    submitted_by: user.id,
    round_label: roundLabel,
    question_text: questionText,
  })

  if (error) {
    return NextResponse.redirect(
      absoluteUrl('/dashboard/applications?question_error=' + encodeURIComponent('Could not submit -- this only works for a company you actually interviewed with.'))
    )
  }

  return NextResponse.redirect(absoluteUrl('/dashboard/applications?question_submitted=1'))
}
