import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const LEVELS = ['junior', 'mid', 'senior', 'lead', 'director', 'executive']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: candidate } = await supabase.from('candidates').select('id').eq('user_id', user.id).single()
  if (!candidate) {
    return NextResponse.redirect(absoluteUrl('/profile'))
  }

  const formData = await request.formData()
  const title = (formData.get('title') as string || '').trim()
  const company = (formData.get('company') as string || '').trim()
  const location = (formData.get('location') as string || '').trim() || null
  const levelRaw = formData.get('level') as string
  const level = LEVELS.includes(levelRaw) ? levelRaw : null
  const startDate = formData.get('start_date') as string
  const isCurrent = formData.get('is_current') === 'true'
  const endDate = isCurrent ? null : (formData.get('end_date') as string) || null
  const salaryRaw = formData.get('salary_amount') as string
  const salaryAmount = salaryRaw ? parseInt(salaryRaw, 10) : null

  if (!title || !company || !startDate) {
    return NextResponse.redirect(absoluteUrl('/profile?error=' + encodeURIComponent('Title, company, and start date are required.')))
  }

  await supabase.from('candidate_employment_history').insert({
    candidate_id: candidate.id,
    title,
    company,
    location,
    level,
    start_date: startDate,
    end_date: endDate,
    is_current: isCurrent,
    salary_amount: salaryAmount,
  })

  return NextResponse.redirect(absoluteUrl('/profile'))
}
