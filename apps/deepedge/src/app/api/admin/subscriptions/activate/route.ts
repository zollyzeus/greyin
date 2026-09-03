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
  const companyId = formData.get('company_id') as string
  const leadId = formData.get('lead_id') as string | null
  const months = parseInt((formData.get('months') as string) || '12', 10)

  const { data: enterprisePlan } = await supabase.from('subscription_plans').select('id').eq('tier', 'enterprise').single()
  if (!enterprisePlan) {
    return NextResponse.redirect(
      absoluteUrl(`/admin/subscriptions?error=${encodeURIComponent('Enterprise plan not configured.')}`)
    )
  }

  // Sales-led Enterprise activation always grants the top hiring tier
  // (096, product='deepedge_hiring', unlimited on every credit type) --
  // matching how Enterprise already meant "no candidate-search limits"
  // before credits existed; there's no per-deal tier picker here.
  const { data: premiumTier } = await supabase
    .from('subscription_tiers')
    .select('id')
    .eq('product', 'deepedge_hiring')
    .eq('tier_key', 'premium')
    .single()

  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + months)

  const { error } = await supabase.from('company_subscriptions').upsert(
    {
      company_id: companyId,
      plan_id: enterprisePlan.id,
      tier_id: premiumTier?.id ?? null,
      status: 'active',
      activated_by: user.id,
      activated_at: new Date().toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' }
  )

  if (error) {
    console.error('Enterprise subscription activation failed:', error)
    return NextResponse.redirect(
      absoluteUrl(`/admin/subscriptions?error=${encodeURIComponent('Could not activate subscription.')}`)
    )
  }

  if (leadId) {
    await supabase.from('enterprise_leads').update({ status: 'converted' }).eq('id', leadId)
  }

  return NextResponse.redirect(absoluteUrl('/admin/subscriptions?success=1'))
}
