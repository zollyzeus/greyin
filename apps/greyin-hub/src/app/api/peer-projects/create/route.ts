import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Creates the project (RLS: creator_id = auth.uid()), which the
// on_peer_project_created trigger auto-confirms the creator's own
// membership for, then tags each selected teammate as 'pending' --
// each tag fires its own notification (on_peer_project_member_tagged)
// so the actual "confirm" step is a decision made where the tagged
// person will see it (the dashboard), not blocked on this request.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/dashboard'))
  }

  const formData = await request.formData()
  const title = (formData.get('title') as string || '').trim()
  const company = (formData.get('company') as string || '').trim()
  const description = (formData.get('description') as string || '').trim() || null
  const startedOn = (formData.get('started_on') as string || '').trim() || null
  const endedOn = (formData.get('ended_on') as string || '').trim() || null
  const teammateIdsRaw = (formData.get('teammate_ids') as string || '').trim()
  const teammateIds = teammateIdsRaw ? teammateIdsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []

  if (!title || !company) {
    return NextResponse.redirect(absoluteUrl('/dashboard?peer_project_error=' + encodeURIComponent('Title and company are required')))
  }

  const { data: project, error: insertError } = await supabase
    .from('peer_projects')
    .insert({ creator_id: user.id, title, company, description, started_on: startedOn, ended_on: endedOn })
    .select('id')
    .single()

  if (insertError || !project) {
    return NextResponse.redirect(absoluteUrl('/dashboard?peer_project_error=' + encodeURIComponent('Could not create project')))
  }

  // Never tag yourself -- you're already the auto-confirmed creator.
  const uniqueTeammateIds = [...new Set(teammateIds)].filter((id) => id !== user.id)
  if (uniqueTeammateIds.length > 0) {
    await supabase.from('peer_project_members').insert(
      uniqueTeammateIds.map((teammateId) => ({ project_id: project.id, user_id: teammateId }))
    )
  }

  return NextResponse.redirect(absoluteUrl('/dashboard?peer_project_created=1'))
}
