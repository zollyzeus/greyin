import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, User, MessageCircle, Award } from 'lucide-react'
import { FollowButton } from '@/components/FollowButton'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, bio, location, years_experience, avatar_url')
    .eq('role', 'member')
    .order('created_at', { ascending: false })
    .limit(50)

  const memberIds = (members || []).map((m) => m.id)
  const { data: scores } = memberIds.length
    ? await supabase.from('reputation_scores').select('user_id, score').in('user_id', memberIds)
    : { data: [] }
  const scoreByUser = new Map((scores || []).map((s) => [s.user_id, s.score]))

  const { data: myFollows } = user
    ? await supabase.from('user_follows').select('followed_id').eq('follower_id', user.id)
    : { data: [] }
  const followingSet = new Set((myFollows || []).map((f) => f.followed_id))

  // "Worked together" discovery (059_collaborators.sql). Pillar is
  // tracked per collaborator (a pair can share history on more than one
  // pillar) so the chip can say *how*, not just *that*.
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <span className="ml-2 text-2xl font-bold">Salt & Pepper</span>
            </a>
            <nav className="flex gap-6">
              <Link href="/discussions" className="text-gray-700 hover:text-purple-600 dark:text-gray-300">Discussions</Link>
              <Link href="/members" className="text-purple-600 font-semibold dark:text-purple-400">Members</Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-gray-50">Members</h1>

        {collaboratorProfiles && collaboratorProfiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">People you&rsquo;ve worked with</h2>
            <div className="flex flex-wrap gap-3">
              {collaboratorProfiles.map((person) => (
                <div key={person.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 dark:border-gray-800">
                  <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <a
                    href={`https://deepedge.greyin.net/candidates/${person.id}`}
                    className="text-sm text-gray-800 hover:text-purple-700 hover:underline dark:text-gray-100 dark:hover:text-purple-300"
                  >
                    {person.full_name || 'A collaborator'}
                  </a>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    via {[...(pillarsByCollaborator.get(person.id) || [])].map((p) => PILLAR_LABEL[p] || p).join(' & ')}
                  </span>
                  <FollowButton targetUserId={person.id} isFollowing={false} next="/members" />
                </div>
              ))}
            </div>
          </div>
        )}

        {members && members.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => (
              <div key={member.id} className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center dark:bg-purple-950/40">
                    <User className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">{member.full_name || 'Member'}</h3>
                    {member.location && <p className="text-sm text-gray-500 dark:text-gray-400">{member.location}</p>}
                  </div>
                </div>
                {!!scoreByUser.get(member.id) && (
                  <p className="flex items-center gap-1 text-xs font-medium text-amber-600 mb-2 dark:text-amber-400">
                    <Award className="h-3.5 w-3.5" />
                    {scoreByUser.get(member.id)} reputation
                  </p>
                )}
                {member.bio && <p className="text-sm text-gray-600 line-clamp-3 mb-2 dark:text-gray-400">{member.bio}</p>}
                {member.years_experience != null && (
                  <p className="text-xs text-purple-700 font-medium dark:text-purple-400">{member.years_experience} years of experience</p>
                )}
                {user && user.id !== member.id && (
                  <div className="flex items-center gap-4">
                    <form action="/api/messages/start" method="POST" className="mt-3">
                      <input type="hidden" name="other_user_id" value={member.id} />
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Message
                      </button>
                    </form>
                    <FollowButton
                      targetUserId={member.id}
                      isFollowing={followingSet.has(member.id)}
                      next="/members"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-gray-50">No members yet</h3>
          </div>
        )}
      </div>
    </main>
  )
}
