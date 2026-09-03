import { redirect } from 'next/navigation'
import { BadgeCheck, Shuffle, RotateCcw, GraduationCap, ArrowUpRight, Users, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { EcosystemWidget } from '@/components/EcosystemWidget'
import { ActivityHeatmap } from '@/components/ActivityHeatmap'
import { PeerProjectsSection, type PendingTag, type PeerProjectView } from '@/components/PeerProjectsSection'

// 'peer' added alongside the two existing pillar-transaction sources
// once 089_peer_projects.sql extended collaborators to include
// mutually-confirmed off-platform projects -- reads the same way here
// ("via Peer-confirmed project") as any other collaboration source.
const PILLAR_LABEL: Record<string, string> = { stackworks: 'StackWorks', flexpro: 'FlexPro', peer: 'Peer-confirmed project' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const [{ data: profile }, { data: scoreRow }, { data: activity }, { data: memberships }, { data: collaboratorRows }, { data: pendingTagRows }, { data: myConfirmedRows }] = await Promise.all([
    supabase.from('profiles').select('created_at, is_pivoter, pivot_from_domain, pivot_to_domain, is_reentry, reentry_reason, is_mentor').eq('id', user.id).single(),
    // peer_score/peer_evidence deliberately NOT selected here for the
    // main badge -- see PeerProjectsSection's own header comment on
    // why platform-verified and peer-confirmed stay two numbers.
    supabase.from('greyin_scores').select('greyin_score, is_verified_expert, peer_score, peer_evidence').eq('user_id', user.id).maybeSingle(),
    supabase.from('my_pillar_activity').select('pillar, event_type, occurred_at'),
    supabase.from('pillar_memberships').select('pillar').eq('user_id', user.id),
    // "Worked together" discovery (059_collaborators.sql) -- shown here
    // once, cross-pillar, rather than duplicated as a per-app widget:
    // Hub is the one place a StackWorks collaborator and a FlexPro
    // collaborator show up side by side regardless of which app you're
    // currently in. Now also picks up 'peer' pairs automatically
    // (089_peer_projects.sql extended this same view).
    supabase.from('collaborators').select('collaborator_id, pillar').eq('user_id', user.id),
    // Peer-project tags awaiting this user's own confirm/decline.
    supabase.from('peer_project_members').select('id, project_id, peer_projects(title, company, creator_id)').eq('user_id', user.id).eq('status', 'pending'),
    // Projects this user is a confirmed member of (creator or tagged).
    supabase.from('peer_project_members').select('project_id, peer_projects(id, title, company, description)').eq('user_id', user.id).eq('status', 'confirmed'),
  ])

  // --- Peer projects: pending tags (need the creator's display name) ---
  const pendingCreatorIds = [...new Set((pendingTagRows || []).map((r: any) => r.peer_projects?.creator_id).filter(Boolean))]
  const { data: pendingCreatorProfiles } = pendingCreatorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', pendingCreatorIds)
    : { data: [] }
  const pendingCreatorNames = new Map((pendingCreatorProfiles || []).map((p) => [p.id, p.full_name]))
  const pendingTags: PendingTag[] = (pendingTagRows || [])
    .filter((r: any) => r.peer_projects)
    .map((r: any) => ({
      id: r.id,
      projectTitle: r.peer_projects.title,
      projectCompany: r.peer_projects.company,
      creatorName: pendingCreatorNames.get(r.peer_projects.creator_id) ?? null,
    }))

  // --- Peer projects: confirmed projects, their confirmed teammates,
  // and which of those this user has already rated ---
  const myProjectIds = [...new Set((myConfirmedRows || []).map((r: any) => r.peer_projects?.id).filter(Boolean))]
  const [{ data: allConfirmedMembers }, { data: myGivenRatings }] = myProjectIds.length
    ? await Promise.all([
        supabase.from('peer_project_members').select('project_id, user_id').in('project_id', myProjectIds).eq('status', 'confirmed'),
        supabase.from('peer_project_ratings').select('project_id, ratee_id').in('project_id', myProjectIds).eq('rater_id', user.id),
      ])
    : [{ data: [] }, { data: [] }]
  const memberUserIds = [...new Set((allConfirmedMembers || []).map((r) => r.user_id))]
  const { data: memberProfiles } = memberUserIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', memberUserIds)
    : { data: [] }
  const memberNames = new Map((memberProfiles || []).map((p) => [p.id, p.full_name]))
  const membersByProject = new Map<string, { userId: string; name: string | null }[]>()
  for (const row of allConfirmedMembers || []) {
    if (!membersByProject.has(row.project_id)) membersByProject.set(row.project_id, [])
    membersByProject.get(row.project_id)!.push({ userId: row.user_id, name: memberNames.get(row.user_id) ?? null })
  }
  const peerProjects: PeerProjectView[] = (myConfirmedRows || [])
    .filter((r: any) => r.peer_projects)
    .map((r: any) => ({
      id: r.peer_projects.id,
      title: r.peer_projects.title,
      company: r.peer_projects.company,
      description: r.peer_projects.description,
      confirmedMembers: membersByProject.get(r.peer_projects.id) || [],
    }))
  const alreadyRatedPairs = new Set((myGivenRatings || []).map((r) => `${r.project_id}:${r.ratee_id}`))

  const pillarsByCollaborator = new Map<string, Set<string>>()
  for (const row of collaboratorRows || []) {
    if (!pillarsByCollaborator.has(row.collaborator_id)) pillarsByCollaborator.set(row.collaborator_id, new Set())
    pillarsByCollaborator.get(row.collaborator_id)!.add(row.pillar)
  }
  const collaboratorIds = [...pillarsByCollaborator.keys()]
  const { data: collaboratorProfiles } = collaboratorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', collaboratorIds)
    : { data: [] }

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Ecosystem Dashboard</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BadgeCheck className="w-5 h-5" />
              Activity across all six platforms
            </h2>
            <div className="flex items-center gap-2">
              {scoreRow?.greyin_score != null && (
                <span className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm font-bold">
                  Greyin Score: {scoreRow.greyin_score}
                </span>
              )}
              {/* Deliberately a separate badge, not folded into Greyin Score
                  above -- peer_score comes from mutually-confirmed,
                  self-reported projects, not a platform transaction. See
                  089_peer_projects.sql's header comment. */}
              {scoreRow?.peer_score != null && (
                <span
                  className="px-3 py-1 bg-white border-2 border-indigo-200 text-indigo-700 rounded-lg text-sm font-bold"
                  title={`Peer-confirmed, not platform-verified -- from ${scoreRow.peer_evidence} contribution rating${scoreRow.peer_evidence === 1 ? '' : 's'}`}
                >
                  Peer-confirmed: {scoreRow.peer_score}
                </span>
              )}
            </div>
          </div>
          <ActivityHeatmap activity={activity ?? []} joinDate={profile?.created_at ?? new Date().toISOString()} />
        </div>

        <PeerProjectsSection
          currentUserId={user.id}
          pendingTags={pendingTags}
          projects={peerProjects}
          alreadyRatedPairs={alreadyRatedPairs}
        />

        {(profile?.is_pivoter || profile?.is_reentry || profile?.is_mentor) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Your tags</h2>
            <div className="flex flex-wrap gap-3">
              {profile?.is_pivoter && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-orange-50 text-orange-700">
                  <Shuffle className="h-4 w-4" />
                  Pivoting: {profile.pivot_from_domain || '—'} → {profile.pivot_to_domain || '—'}
                </span>
              )}
              {profile?.is_reentry && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700">
                  <RotateCcw className="h-4 w-4" />
                  Returning to work{profile.reentry_reason ? ` · ${profile.reentry_reason}` : ''}
                </span>
              )}
              {profile?.is_mentor && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-purple-50 text-purple-700">
                  <GraduationCap className="h-4 w-4" />
                  Listed as a mentor
                </span>
              )}
            </div>
            <a href="https://deepedge.greyin.net/profile" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Manage on your profile <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {collaboratorProfiles && collaboratorProfiles.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              People you&rsquo;ve worked with
            </h2>
            <div className="flex flex-wrap gap-3">
              {collaboratorProfiles.map((person) => (
                <a
                  key={person.id}
                  href={`https://deepedge.greyin.net/candidates/${person.id}`}
                  className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-800">{person.full_name || 'A collaborator'}</span>
                  <span className="text-xs text-gray-400">
                    via {[...(pillarsByCollaborator.get(person.id) || [])].map((p) => PILLAR_LABEL[p] || p).join(' & ')}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />
      </div>
    </main>
  )
}
