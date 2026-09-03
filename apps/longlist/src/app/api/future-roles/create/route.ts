import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const VALID_TIMEFRAMES = ['3_months', '6_months', '9_months', '12_months']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/post'))
  }

  // RLS's own WITH CHECK (087) re-derives and enforces this exact
  // ownership requirement server-side regardless of what's sent here --
  // this lookup is just to give a clean error instead of a raw RLS
  // rejection.
  const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()
  if (!company) {
    return NextResponse.redirect(absoluteUrl('/post'))
  }

  const formData = await request.formData()
  const title = (formData.get('title') as string)?.trim()
  const function_area = (formData.get('function_area') as string)?.trim() || null
  const seniority_level = (formData.get('seniority_level') as string)?.trim() || null
  const target_timeframe = formData.get('target_timeframe') as string
  const description = (formData.get('description') as string)?.trim()
  const skillsRaw = (formData.get('skills') as string) || ''
  const location = (formData.get('location') as string)?.trim() || null
  const is_remote = formData.get('is_remote') === 'true'

  if (!title || !description || !VALID_TIMEFRAMES.includes(target_timeframe)) {
    return NextResponse.redirect(absoluteUrl(`/post?error=${encodeURIComponent('Title, description, and a timeframe are required.')}`))
  }

  const skills = skillsRaw.split(',').map((s) => s.trim()).filter(Boolean)

  const { error } = await supabase.from('future_roles').insert({
    company_id: company.id,
    posted_by: user.id,
    title,
    function_area,
    seniority_level,
    target_timeframe,
    description,
    skills,
    location,
    is_remote,
  })

  if (error) {
    return NextResponse.redirect(absoluteUrl(`/post?error=${encodeURIComponent('Could not post that role. Please try again.')}`))
  }

  return NextResponse.redirect(absoluteUrl('/employer/roles?posted=1'))
}
