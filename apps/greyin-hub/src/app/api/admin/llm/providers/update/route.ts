import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

/** v1 admin panel only toggles enabled/priority in place -- changing the model or key means delete + re-add, matching this app's other admin sections (no edit-in-place anywhere else either). */
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
  const providerId = formData.get('provider_id') as string
  const enabled = formData.get('enabled') === 'true'

  await supabase
    .from('llm_providers')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', providerId)

  return NextResponse.redirect(absoluteUrl('/admin/llm'))
}
