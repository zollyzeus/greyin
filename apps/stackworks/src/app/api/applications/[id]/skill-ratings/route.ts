import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: ratings } = await supabase
    .from('skill_ratings')
    .select('skill, rating, stage')
    .eq('project_application_id', params.id)
    .eq('rater_id', user.id)

  // Lets the client know whether the "revise to verified" step is even
  // possible yet -- verified_outcomes readable by anyone once
  // status='verified' (030's own RLS), same read used elsewhere on this
  // page for track-record display.
  const { data: outcome } = await supabase
    .from('verified_outcomes')
    .select('status')
    .eq('application_id', params.id)
    .eq('status', 'verified')
    .maybeSingle()

  return NextResponse.json({ ratings: ratings || [], verified: !!outcome })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { skill, rating, ratee_id: rateeId } = await request.json()
  if (!skill || !rating || !rateeId) {
    return NextResponse.json({ error: 'skill, rating, and ratee_id are required' }, { status: 400 })
  }

  // RLS ("StackWorks collaborators can give an initial skill rating")
  // enforces the bidirectional, chat-or-closed+accepted gate -- a
  // failure here is a real rejection (no interaction yet), not a
  // formality.
  const { error } = await supabase
    .from('skill_ratings')
    .insert({ rater_id: user.id, ratee_id: rateeId, skill, rating, project_application_id: params.id, stage: 'initial' })

  if (error) {
    return NextResponse.json({ error: 'Could not save rating — you may need to have interacted first.' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { skill, rating } = await request.json()
  if (!skill || !rating) {
    return NextResponse.json({ error: 'skill and rating are required' }, { status: 400 })
  }

  // RLS ("Raters can revise their rating once the outcome is verified")
  // enforces this only succeeds once a real verified_outcomes row
  // exists for this application/ratee.
  const { error } = await supabase
    .from('skill_ratings')
    .update({ rating, stage: 'verified' })
    .eq('project_application_id', params.id)
    .eq('rater_id', user.id)
    .eq('skill', skill)

  if (error) {
    return NextResponse.json({ error: 'Could not revise rating.' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
