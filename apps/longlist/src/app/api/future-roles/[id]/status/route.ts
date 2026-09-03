import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const VALID_STATUSES = ['open', 'filled', 'expired']

// RLS's "Employer manages own future roles" policy (087) is the real
// gate -- a non-owner's UPDATE simply matches zero rows.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/employer/roles'))
  }

  const formData = await request.formData()
  const status = formData.get('status') as string
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.redirect(absoluteUrl('/employer/roles'))
  }

  await supabase.from('future_roles').update({ status, updated_at: new Date().toISOString() }).eq('id', id)

  return NextResponse.redirect(absoluteUrl('/employer/roles'))
}
