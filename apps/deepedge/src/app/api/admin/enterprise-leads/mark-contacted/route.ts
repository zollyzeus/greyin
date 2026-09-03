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
  const leadId = formData.get('lead_id') as string

  const { error } = await supabase.from('enterprise_leads').update({ status: 'contacted' }).eq('id', leadId)

  if (error) {
    console.error('Marking lead contacted failed:', error)
    return NextResponse.redirect(
      absoluteUrl(`/admin/subscriptions?error=${encodeURIComponent('Could not update the lead.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl('/admin/subscriptions?success=contacted'))
}
