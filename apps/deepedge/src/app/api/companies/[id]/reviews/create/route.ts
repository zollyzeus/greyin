import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const rating = parseInt(formData.get('rating') as string, 10)
  const reviewText = (formData.get('review_text') as string || '').trim() || null

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.redirect(absoluteUrl(`/companies/${companyId}?error=` + encodeURIComponent('A rating is required.')))
  }

  // RLS ("Candidates who applied can review that company") enforces a
  // real application on record -- a rejection here means the caller
  // never actually applied to a job at this company.
  const { error } = await supabase
    .from('company_reviews')
    .insert({ company_id: companyId, reviewer_id: user.id, rating, review_text: reviewText })

  if (error) {
    return NextResponse.redirect(absoluteUrl(`/companies/${companyId}?error=` + encodeURIComponent('Could not submit review — you may need to have applied here first.')))
  }

  return NextResponse.redirect(absoluteUrl(`/companies/${companyId}?success=1`))
}
