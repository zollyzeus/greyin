import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const role = (formData.get('role') as string || '').toLowerCase().trim()
  const level = (formData.get('level') as string) || null
  const location = ((formData.get('location') as string) || '').toLowerCase().trim() || null

  if (!role) {
    return NextResponse.redirect(absoluteUrl('/salary-trends'))
  }

  // Upsert -- watching the same combination twice is a no-op, not an
  // error (salary_trend_watches has a UNIQUE(user_id, role_title,
  // level, location) constraint, 063).
  await supabase.from('salary_trend_watches').upsert(
    { user_id: user.id, role_title: role, level, location },
    { onConflict: 'user_id,role_title,level,location', ignoreDuplicates: true }
  )

  const params = new URLSearchParams({ role })
  if (level) params.set('level', level)
  if (location) params.set('location', location)
  return NextResponse.redirect(absoluteUrl(`/salary-trends?${params.toString()}&watched=1`))
}
