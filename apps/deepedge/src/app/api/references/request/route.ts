import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

/**
 * Looks up the application this employer's own request-reference action
 * should be tied to, rather than trusting a client-submitted application
 * id -- create_reference_request() (065) re-validates ownership anyway,
 * but resolving it server-side keeps the form itself minimal (just the
 * reference id and which candidate this is for).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const referenceId = formData.get('reference_id') as string
  const candidateProfileId = formData.get('candidate_profile_id') as string

  const { data: myCompany } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()
  const { data: candidateRow } = myCompany
    ? await supabase.from('candidates').select('id').eq('user_id', candidateProfileId).maybeSingle()
    : { data: null }
  const { data: myJobs } = myCompany ? await supabase.from('jobs').select('id').eq('company_id', myCompany.id) : { data: [] }
  const jobIds = (myJobs || []).map((j) => j.id)

  const { data: apps } = candidateRow && jobIds.length
    ? await supabase
        .from('applications')
        .select('id')
        .eq('candidate_id', candidateRow.id)
        .in('job_id', jobIds)
        .order('applied_at', { ascending: false })
        .limit(1)
    : { data: [] }
  const applicationId = apps?.[0]?.id

  if (!applicationId) {
    return NextResponse.redirect(
      absoluteUrl(`/candidates/${candidateProfileId}?error=` + encodeURIComponent('This candidate hasn’t applied to one of your jobs.'))
    )
  }

  const { error } = await supabase.rpc('create_reference_request', {
    p_reference_id: referenceId,
    p_application_id: applicationId,
  })

  if (error) {
    console.error('Failed to create reference request:', error)
    return NextResponse.redirect(
      absoluteUrl(`/candidates/${candidateProfileId}?error=` + encodeURIComponent('Could not send this reference request.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/candidates/${candidateProfileId}?success=1`))
}
