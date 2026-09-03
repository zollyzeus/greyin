import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const featureRequestId = formData.get('feature_request_id') as string
  const action = formData.get('action') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/wishlist'))
  }

  if (action === 'remove') {
    await supabase.from('feature_request_upvotes').delete().eq('feature_request_id', featureRequestId).eq('user_id', user.id)
  } else {
    await supabase.from('feature_request_upvotes').insert({ feature_request_id: featureRequestId, user_id: user.id })
  }

  return NextResponse.redirect(absoluteUrl('/wishlist'))
}
