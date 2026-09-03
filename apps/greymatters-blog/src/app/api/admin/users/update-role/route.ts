import { createClient } from '@/app/lib/supabase/server'
import { absoluteUrl } from '@/app/lib/site-url'
import { NextResponse } from 'next/server'

const VALID_ROLES = ['candidate', 'client', 'freelancer', 'admin', 'author', 'employer', 'member']

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const userId = formData.get('user_id') as string
  const role = formData.get('role') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.redirect(absoluteUrl(`/admin?error=${encodeURIComponent('Invalid role.')}`))
  }

  await supabase.from('profiles').update({ role }).eq('id', userId)

  return NextResponse.redirect(absoluteUrl('/admin?role_updated=1'))
}
