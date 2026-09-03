import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const packagePurchaseId = formData.get('package_purchase_id') as string

  const { data: slot } = await supabase.from('mentor_session_slots').select('gig_id').eq('id', id).single()

  // book_slot_with_credit() (062) redeems one session credit instead
  // of creating a new payment -- works for both 1:1 and cohort slots.
  const { error } = await supabase.rpc('book_slot_with_credit', {
    p_slot_id: id,
    p_package_purchase_id: packagePurchaseId,
  })

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(`/mentor-sessions/${slot?.gig_id || ''}?error=` + encodeURIComponent('That session credit could not be used for this slot.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/mentor-sessions/${slot?.gig_id || ''}?success=1`))
}
