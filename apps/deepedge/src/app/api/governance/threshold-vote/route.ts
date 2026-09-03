import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/governance/threshold'))
  }

  const formData = await request.formData()
  const proposedYears = parseInt(formData.get('proposed_years') as string, 10)
  const proposedScore = parseInt(formData.get('proposed_score') as string, 10)
  const comment = ((formData.get('comment') as string) || '').trim() || null

  if (!Number.isFinite(proposedYears) || proposedYears < 0 || !Number.isFinite(proposedScore) || proposedScore < 0 || proposedScore > 100) {
    return NextResponse.redirect(
      absoluteUrl(`/governance/threshold?error=${encodeURIComponent('Please enter a valid years value and a score between 0 and 100.')}`)
    )
  }

  const { error } = await supabase.from('threshold_votes').upsert(
    {
      user_id: user.id,
      proposed_years: proposedYears,
      proposed_score: proposedScore,
      comment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('Threshold vote failed:', error)
    return NextResponse.redirect(
      absoluteUrl(`/governance/threshold?error=${encodeURIComponent('Could not record your vote. Please try again.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl('/governance/threshold?success=1'))
}
