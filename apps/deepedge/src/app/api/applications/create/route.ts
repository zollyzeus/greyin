import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const jobId = formData.get('job_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/jobs/${jobId}/apply`))
  }

  // Candidacy itself is gated to Verified Expert status (12+ years, or
  // enough cross-platform Greyin Score to substitute for it) -- signup
  // stays open, but this is the actual gate, checked at the point where
  // it matters instead of turning people away at the door. A Verified
  // Expert who's tagged themselves as pivoting gets a second path in:
  // jobs the employer explicitly opened to career changers, even without
  // domain-relevant experience for this specific role.
  const [{ data: scoreRow }, { data: profile }, { data: job }] = await Promise.all([
    supabase.from('greyin_scores').select('is_verified_expert').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('is_pivoter').eq('id', user.id).maybeSingle(),
    supabase.from('jobs').select('open_to_career_changers').eq('id', jobId).maybeSingle(),
  ])

  const eligible = scoreRow?.is_verified_expert || (job?.open_to_career_changers && profile?.is_pivoter)

  if (!eligible) {
    const message = job?.open_to_career_changers
      ? 'This role is open to career changers, but only for Verified Experts who have tagged themselves as pivoting. Set that up on your profile.'
      : 'You need senior-level experience or a Greyin Score of 75+ to apply. Build yours on StackWorks, FlexPro, or Salt & Pepper.'
    return NextResponse.redirect(
      absoluteUrl(`/jobs/${jobId}/apply?error=${encodeURIComponent(message)}`)
    )
  }

  // Cover users who signed up before the candidates row was reliably created.
  let { data: candidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!candidate) {
    const { data: newCandidate } = await supabase
      .from('candidates')
      .insert({ user_id: user.id })
      .select('id')
      .single()
    candidate = newCandidate
  }

  if (!candidate) {
    return NextResponse.redirect(
      absoluteUrl(`/jobs/${jobId}/apply?error=${encodeURIComponent('Could not set up your candidate profile. Please try again.')}`)
    )
  }

  const expectedSalaryRaw = formData.get('expected_salary') as string
  const availableFromRaw = formData.get('available_from') as string

  const { error } = await supabase.from('applications').insert({
    job_id: jobId,
    candidate_id: candidate.id,
    cover_letter: (formData.get('cover_letter') as string) || null,
    resume_url: (formData.get('resume_url') as string) || null,
    expected_salary: expectedSalaryRaw ? parseInt(expectedSalaryRaw, 10) : null,
    available_from: availableFromRaw || null,
  })

  if (error) {
    const message = error.code === '23505'
      ? "You've already applied to this job."
      : 'Could not submit your application. Please try again.'
    return NextResponse.redirect(
      absoluteUrl(`/jobs/${jobId}/apply?error=${encodeURIComponent(message)}`)
    )
  }

  return NextResponse.redirect(
    absoluteUrl('/dashboard/applications?success=1')
  )
}
