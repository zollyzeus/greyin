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
  const featureKey = formData.get('feature_key') as string
  const enabled = formData.get('enabled') === 'true'
  const providerId = (formData.get('provider_id') as string || '') || null
  // Empty string (field omitted for flags with no sweep mechanism, or
  // cleared by the admin) means "no periodic sweep" -- NULL, not 0,
  // since 0 would mean "sweep every tick" which nothing intends.
  const sweepIntervalRaw = (formData.get('sweep_interval_minutes') as string || '').trim()
  const sweepIntervalMinutes = sweepIntervalRaw ? parseInt(sweepIntervalRaw, 10) : null

  await supabase
    .from('llm_feature_flags')
    .update({
      enabled,
      provider_id: providerId,
      sweep_interval_minutes: sweepIntervalMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq('feature_key', featureKey)

  return NextResponse.redirect(absoluteUrl('/admin/llm'))
}
