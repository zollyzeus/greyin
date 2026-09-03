import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const RELATIONSHIP_TYPES = ['in_platform_task', 'ex_colleague', 'current_colleague', 'other']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const referenceUserId = formData.get('reference_user_id') as string
  const relationshipType = formData.get('relationship_type') as string
  const relationshipDetail = (formData.get('relationship_detail') as string || '').trim()

  if (!referenceUserId || !RELATIONSHIP_TYPES.includes(relationshipType) || !relationshipDetail) {
    return NextResponse.redirect(
      absoluteUrl(`/candidates/${referenceUserId}?error=` + encodeURIComponent('Pick a relationship type and describe how you worked together.'))
    )
  }

  const { error } = await supabase
    .from('professional_references')
    .insert({
      candidate_id: user.id,
      reference_user_id: referenceUserId,
      relationship_type: relationshipType,
      relationship_detail: relationshipDetail,
    })

  // 23505 = unique_violation -- already added, treat as idempotent success.
  if (error && error.code !== '23505') {
    console.error('Failed to add reference:', error)
    return NextResponse.redirect(
      absoluteUrl(`/candidates/${referenceUserId}?error=` + encodeURIComponent('Could not add this person as a reference.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/candidates/${referenceUserId}?success=1`))
}
