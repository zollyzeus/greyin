import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Employer self-service close/reopen (Emergent gap audit item #1 --
// previously only api/admin/jobs/close existed, admin-only, and no
// reopen route existed at all). jobs' own RLS ("Company owners can
// update their jobs", 003) already lets an employer update any field
// on their own job unrestricted -- that's the real enforcement here,
// same "RLS is the boundary, this check is just a clean redirect"
// pattern as api/jobs/[id]/feed-visibility. Scoped to exactly these
// two values (not a general status editor) so this route can't be used
// to set 'draft' or 'filled', which have their own dedicated flows.
const SELF_SERVICE_STATUSES = ['closed', 'open']

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const status = formData.get('status') as string
  if (!SELF_SERVICE_STATUSES.includes(status)) {
    return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
  }

  await supabase.from('jobs').update({ status }).eq('id', id)

  return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
}
