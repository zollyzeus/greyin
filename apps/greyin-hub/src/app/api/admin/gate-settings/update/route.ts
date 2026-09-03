import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const formData = await request.formData()
  const minYearsExperience = parseInt(formData.get('min_years_experience') as string, 10)
  const minGreyinScore = parseInt(formData.get('min_greyin_score') as string, 10)

  if (!Number.isFinite(minYearsExperience) || minYearsExperience < 0 || !Number.isFinite(minGreyinScore) || minGreyinScore < 0 || minGreyinScore > 100) {
    return NextResponse.redirect(
      absoluteUrl(`/admin/threshold-votes?error=${encodeURIComponent('Please enter valid values.')}`)
    )
  }

  const { error } = await supabase
    .from('platform_gate_settings')
    .update({
      min_years_experience: minYearsExperience,
      min_greyin_score: minGreyinScore,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) {
    console.error('Gate settings update failed:', error)
    return NextResponse.redirect(
      absoluteUrl(`/admin/threshold-votes?error=${encodeURIComponent('Could not update gate settings.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl('/admin/threshold-votes?success=1'))
}
