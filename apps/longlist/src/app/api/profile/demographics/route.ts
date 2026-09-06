import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const VALID_GENDER = ['woman', 'man', 'non_binary', 'self_describe', 'prefer_not_to_say']
const VALID_AGE_RANGE = ['under_25', '25_34', '35_44', '45_54', '55_64', '65_plus', 'prefer_not_to_say']
const VALID_DISABILITY = ['yes', 'no', 'prefer_not_to_say']

/**
 * Entirely optional self-ID for the bias/fairness audit (119) -- never
 * required, RLS on profile_demographics only ever lets a user write
 * their own row (see the migration's own comment on why this is a
 * separate table from profiles, not a shared select('*') risk).
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/profile'))
  }

  const formData = await request.formData()
  const gender = formData.get('gender') as string
  const genderSelfDescription = (formData.get('gender_self_description') as string || '').trim() || null
  const ageRange = formData.get('age_range') as string
  const disabilityStatus = formData.get('disability_status') as string

  await supabase.from('profile_demographics').upsert(
    {
      user_id: user.id,
      gender: VALID_GENDER.includes(gender) ? gender : null,
      gender_self_description: gender === 'self_describe' ? genderSelfDescription : null,
      age_range: VALID_AGE_RANGE.includes(ageRange) ? ageRange : null,
      disability_status: VALID_DISABILITY.includes(disabilityStatus) ? disabilityStatus : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  return NextResponse.redirect(absoluteUrl('/profile?saved=1'))
}
