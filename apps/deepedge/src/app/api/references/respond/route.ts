import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { runReferenceSynthesisIfDue } from '@/lib/reference-synthesis'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const requestId = formData.get('request_id') as string
  const body = (formData.get('body') as string || '').trim()

  if (!requestId || !body) {
    return NextResponse.redirect(absoluteUrl('/references/respond?error=' + encodeURIComponent('Write a response before submitting.')))
  }

  // RLS ("Only the named referee can respond to their own pending
  // request") enforces this is really addressed to the current user and
  // hasn't already been answered.
  const { error } = await supabase
    .from('reference_responses')
    .insert({ request_id: requestId, responder_id: user.id, body })

  if (error) {
    console.error('Failed to submit reference response:', error)
    return NextResponse.redirect(absoluteUrl('/references/respond?error=' + encodeURIComponent('Could not submit your response.')))
  }

  // Best-effort: a second (or later) response for the same candidate/employer
  // pair may now be enough to synthesize a report. Never blocks the redirect
  // below on an AI-call failure -- same "skip, don't fail" contract as
  // runPostQualityCheck.
  try {
    const { data: reqRow } = await supabase
      .from('reference_requests')
      .select('requested_by, professional_references:reference_id ( candidate_id )')
      .eq('id', requestId)
      .single()
    const candidateId = (reqRow?.professional_references as unknown as { candidate_id: string } | null)?.candidate_id
    if (candidateId && reqRow?.requested_by) {
      await runReferenceSynthesisIfDue(candidateId, reqRow.requested_by)
    }
  } catch (synthesisError) {
    console.error('Reference synthesis failed:', synthesisError)
  }

  return NextResponse.redirect(absoluteUrl('/references/respond?success=1'))
}
