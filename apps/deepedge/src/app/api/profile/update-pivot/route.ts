import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  // Only a Verified Expert can tag themselves as a pivoter -- keeps this
  // as "senior, changing lanes" rather than a backdoor around the gate.
  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('is_verified_expert')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!scoreRow?.is_verified_expert) {
    return NextResponse.redirect(
      absoluteUrl(`/profile?error=${encodeURIComponent('Verified Expert status is required to set a career pivot.')}`)
    )
  }

  const formData = await request.formData()
  const isPivoter = formData.get('is_pivoter') === 'on'
  const pivotFromDomain = ((formData.get('pivot_from_domain') as string) || '').trim() || null
  const pivotToDomain = ((formData.get('pivot_to_domain') as string) || '').trim() || null
  const pivotNote = ((formData.get('pivot_note') as string) || '').trim() || null
  const pivotStatus = (formData.get('pivot_status') as string) === 'completed' ? 'completed' : 'seeking'

  const { error } = await supabase
    .from('profiles')
    .update({
      is_pivoter: isPivoter,
      pivot_from_domain: pivotFromDomain,
      pivot_to_domain: pivotToDomain,
      pivot_note: pivotNote,
      pivot_status: isPivoter ? pivotStatus : null,
    })
    .eq('id', user.id)

  if (error) {
    console.error('Pivot status update failed:', error)
    return NextResponse.redirect(
      absoluteUrl(`/profile?error=${encodeURIComponent('Could not save your pivot status.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl('/profile?success=1'))
}
