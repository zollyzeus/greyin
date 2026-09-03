import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isBuilder } from '@/lib/stackworks-role'
import { Users, User, BadgeCheck, Hammer, Sparkles, Shuffle, RotateCcw } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { FollowButton } from '@/components/FollowButton'

/**
 * Public directory of stackworks participants -- the piece that actually
 * closes the "build a public verified track record" loop, rather than
 * only surfacing it in-context on a specific application. Reuses
 * saltnpepper-community's /members pattern (profile card grid + a
 * sidecar aggregate query) with stackworks's own signal: verified_outcomes
 * instead of reputation_scores.
 */
export default async function PeoplePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // pillar_memberships is the authoritative "this person actually
  // participates in stackworks" signal -- it's set on stackworks signup AND on
  // an existing Salt & Pepper member's first stackworks login (via
  // ensure_pillar_membership), so it also captures Builders who never
  // filled out a stackworks-specific signup form.
  const { data: memberships } = await supabase
    .from('pillar_memberships')
    .select('user_id')
    .eq('pillar', 'stackworks')
    .order('created_at', { ascending: false })
    .limit(100)

  const userIds = (memberships || []).map((m) => m.user_id)

  const { data: people } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id, full_name, bio, location, years_experience, stackworks_role, created_at, is_pivoter, pivot_from_domain, pivot_to_domain, pivot_status, is_reentry, reentry_reason')
        .in('id', userIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const peopleIds = (people || []).map((p) => p.id)
  const { data: outcomes } = peopleIds.length
    ? await supabase.from('verified_outcomes').select('subject_user_id, score').in('subject_user_id', peopleIds).eq('status', 'verified')
    : { data: [] }

  // greyin_scores (036) is the unified, Bayesian-shrunk, headcount-weighted
  // score across all three trust signals (StackWorks/FlexPro/Salt & Pepper) --
  // this is what actually ranks the directory now, not just StackWorks's own
  // avg score. Falls back to the old avg-score sort for anyone the view
  // has no score for yet (no evidence on any platform).
  const { data: scoreRows } = peopleIds.length
    ? await supabase.from('greyin_scores').select('user_id, greyin_score, stackworks_score, flexpro_score, saltnpepper_score').in('user_id', peopleIds)
    : { data: [] }
  const scoreByUser = new Map((scoreRows || []).map((s) => [s.user_id, s]))

  const { data: myFollows } = user
    ? await supabase.from('user_follows').select('followed_id').eq('follower_id', user.id)
    : { data: [] }
  const followingSet = new Set((myFollows || []).map((f) => f.followed_id))

  // "Worked together" discovery (059_collaborators.sql) -- real
  // collaboration history (accepted StackWorks applications, completed
  // FlexPro orders), not a generic suggestion algorithm. Only people
  // not already followed, so this doesn't just repeat the follow list.
  // Pillar is tracked per collaborator (a pair can share history on more
  // than one pillar) so the chip can say *how*, not just *that*.
  const { data: collaboratorRows } = user
    ? await supabase.from('collaborators').select('collaborator_id, pillar').eq('user_id', user.id)
    : { data: [] }
  const pillarsByCollaborator = new Map<string, Set<string>>()
  for (const row of collaboratorRows || []) {
    if (!pillarsByCollaborator.has(row.collaborator_id)) pillarsByCollaborator.set(row.collaborator_id, new Set())
    pillarsByCollaborator.get(row.collaborator_id)!.add(row.pillar)
  }
  const collaboratorIds = [...pillarsByCollaborator.keys()].filter((cid) => !followingSet.has(cid))
  const { data: collaboratorProfiles } = collaboratorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', collaboratorIds)
    : { data: [] }
  const PILLAR_LABEL: Record<string, string> = { stackworks: 'StackWorks', flexpro: 'FlexPro' }

  const trackRecordByUser = new Map<string, { count: number; avgScore: number }>()
  for (const personId of peopleIds) {
    const rows = (outcomes || []).filter((o) => o.subject_user_id === personId)
    if (rows.length > 0) {
      trackRecordByUser.set(personId, {
        count: rows.length,
        avgScore: Math.round(rows.reduce((sum, r) => sum + (r.score || 0), 0) / rows.length),
      })
    }
  }

  const sortedPeople = [...(people || [])].sort((a, b) => {
    const scoreA = scoreByUser.get(a.id)?.greyin_score
    const scoreB = scoreByUser.get(b.id)?.greyin_score
    if (scoreA != null && scoreB != null) return scoreB - scoreA
    if (scoreA != null) return -1
    if (scoreB != null) return 1
    const tA = trackRecordByUser.get(a.id)
    const tB = trackRecordByUser.get(b.id)
    if (tA && tB) return tB.avgScore - tA.avgScore || tB.count - tA.count
    if (tA) return -1
    if (tB) return 1
    return 0
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-12 w-12" />
            <h1 className="text-5xl font-bold">People</h1>
          </div>
          <p className="text-xl opacity-90 max-w-2xl">
            Builders posting real work and the Supporters earning a verified record by shipping it.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {collaboratorProfiles && collaboratorProfiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">People you&rsquo;ve worked with</h2>
            <div className="flex flex-wrap gap-3">
              {collaboratorProfiles.map((person) => (
                <div key={person.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <a
                    href={`https://deepedge.greyin.net/candidates/${person.id}`}
                    className="text-sm text-gray-800 hover:text-teal-700 hover:underline"
                  >
                    {person.full_name || 'A collaborator'}
                  </a>
                  <span className="text-xs text-gray-400">
                    via {[...(pillarsByCollaborator.get(person.id) || [])].map((p) => PILLAR_LABEL[p] || p).join(' & ')}
                  </span>
                  <FollowButton targetUserId={person.id} isFollowing={false} next="/people" />
                </div>
              ))}
            </div>
          </div>
        )}

        {sortedPeople.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPeople.map((person) => {
              const builder = isBuilder({ years_experience: person.years_experience, stackworks_role: person.stackworks_role })
              const track = trackRecordByUser.get(person.id)
              const greyinScore = scoreByUser.get(person.id)?.greyin_score
              return (
                <div key={person.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{person.full_name || 'StackWorks member'}</h3>
                        {person.location && <p className="text-sm text-gray-500">{person.location}</p>}
                      </div>
                    </div>
                    {greyinScore != null && (
                      <span className="flex-shrink-0 px-2.5 py-1 bg-gray-900 text-white rounded-lg text-xs font-bold" title="Greyin Score: career experience + verified track record across all Greyin platforms">
                        {greyinScore}
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${
                      builder ? 'bg-teal-50 text-teal-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {builder ? <Hammer className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {builder ? 'Builder' : 'Supporter'}
                  </span>
                  {person.is_pivoter && person.pivot_status === 'seeking' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ml-2 bg-orange-50 text-orange-700">
                      <Shuffle className="h-3.5 w-3.5" />
                      Pivoting into {person.pivot_to_domain || 'a new domain'}
                    </span>
                  )}
                  {person.is_reentry && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ml-2 bg-blue-50 text-blue-700">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Returning to work
                    </span>
                  )}
                  {track ? (
                    <p className="flex items-center gap-1 text-xs font-medium text-green-700 mb-2">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {track.count} verified outcome{track.count === 1 ? '' : 's'} · avg {track.avgScore}/100
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mb-2">No verified outcomes yet</p>
                  )}
                  {person.bio && <p className="text-sm text-gray-600 line-clamp-3 mb-2">{person.bio}</p>}
                  {builder && person.years_experience != null && (
                    <p className="text-xs text-gray-500">{person.years_experience} years of experience</p>
                  )}
                  {user && user.id !== person.id && (
                    <FollowButton
                      targetUserId={person.id}
                      isFollowing={followingSet.has(person.id)}
                      next="/people"
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No one here yet</h3>
            <p className="text-gray-600 mb-6">Be the first to sign up — as whichever one you are.</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/signup?track=builder"
                className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700"
              >
                Post a project as a Builder
              </Link>
              <Link
                href="/signup?track=supporter"
                className="border border-teal-600 text-teal-700 px-6 py-3 rounded-lg font-semibold hover:bg-teal-50"
              >
                Join as a Supporter
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
