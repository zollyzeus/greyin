import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return redirect('/login')
  }

  const skillsString = formData.get('skills') as string
  const skills = skillsString ? skillsString.split(',').map(s => s.trim()).filter(s => s) : []

  const languagesString = formData.get('languages') as string
  const languages = languagesString ? languagesString.split(',').map(s => s.trim()).filter(s => s) : []

  // Update profile
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: formData.get('full_name'),
      phone: formData.get('phone'),
      location: formData.get('location'),
      // FIXED (integrity audit 2026-09-04): 'title'/'languages' were
      // bundled into this update with no such profiles columns, failing
      // the whole statement for every FlexPro user's profile save (any
      // one unknown column rejects the entire PostgREST update). Both
      // now have real columns (114).
      title: formData.get('title'),
      bio: formData.get('bio'),
      languages: languages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Profile update error:', error)
    return redirect('/profile?error=update_failed')
  }

  // 'skills' is deliberately NOT a profiles column -- redirected to the
  // existing platform-wide profile_skills table instead (114), the same
  // one skill_endorsements/skill_ratings already read and that DeepEdge's
  // candidates.skills already syncs into via a trigger. Full replace
  // (delete what's no longer listed, then add what's new) matches the
  // "edit my current skill list" UX the form presents, and is safe:
  // skill_endorsements.skill is a plain text match, not a FK to this
  // table, so removing a skill here never cascades or destroys
  // endorsement history.
  const { data: existingSkillRows } = await supabase
    .from('profile_skills')
    .select('skill')
    .eq('user_id', user.id)
  const existingSkills = (existingSkillRows || []).map((r) => r.skill)
  const skillsToRemove = existingSkills.filter((s) => !skills.includes(s))
  const skillsToAdd = skills.filter((s) => !existingSkills.includes(s))

  if (skillsToRemove.length > 0) {
    await supabase.from('profile_skills').delete().eq('user_id', user.id).in('skill', skillsToRemove)
  }
  if (skillsToAdd.length > 0) {
    await supabase.from('profile_skills').upsert(
      skillsToAdd.map((skill) => ({ user_id: user.id, skill })),
      { onConflict: 'user_id,skill', ignoreDuplicates: true }
    )
  }

  return redirect('/profile?success=true')
}
