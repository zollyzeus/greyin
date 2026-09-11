import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const inquiryId = formData.get('inquiry_id') as string
  const status = formData.get('status') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  if (['contacted', 'closed', 'new'].includes(status)) {
    await supabase.from('business_inquiries').update({ status }).eq('id', inquiryId)
  }

  return NextResponse.redirect(absoluteUrl('/admin/contact'))
}
