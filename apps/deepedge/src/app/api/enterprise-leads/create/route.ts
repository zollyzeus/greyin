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
  const companyName = ((formData.get('company_name') as string) || '').trim()
  const contactName = ((formData.get('contact_name') as string) || '').trim()
  const contactEmail = ((formData.get('contact_email') as string) || '').trim()
  const teamSize = (formData.get('team_size') as string) || null
  const message = ((formData.get('message') as string) || '').trim() || null
  const serviceTypeRaw = formData.get('service_type') as string
  const serviceType = ['subscription', 'fractional_leadership', 'outplacement', 'general'].includes(serviceTypeRaw)
    ? serviceTypeRaw
    : 'subscription'

  if (!companyName || !contactName || !contactEmail) {
    return NextResponse.redirect(
      absoluteUrl(`/enterprise-contact?service=${serviceType}&error=${encodeURIComponent('Please fill in all required fields.')}`)
    )
  }

  const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()

  const { error } = await supabase.from('enterprise_leads').insert({
    company_id: company?.id || null,
    user_id: user.id,
    company_name: companyName,
    contact_name: contactName,
    contact_email: contactEmail,
    team_size: teamSize,
    message,
    service_type: serviceType,
  })

  if (error) {
    console.error('Enterprise lead creation failed:', error)
    return NextResponse.redirect(
      absoluteUrl(`/enterprise-contact?service=${serviceType}&error=${encodeURIComponent('Could not submit your request. Please try again.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl('/enterprise-contact?success=1'))
}
