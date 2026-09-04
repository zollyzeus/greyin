import { createClient } from '@/lib/supabase/server'
import { Shuffle, User, MessageCircle, GraduationCap, RotateCcw, CalendarClock } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

export default async function MentorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let myTargetDomain: string | null = null
  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('pivot_to_domain, pivot_status')
      .eq('id', user.id)
      .maybeSingle()
    if (myProfile?.pivot_status === 'seeking') {
      myTargetDomain = myProfile.pivot_to_domain
    }
  }

  // Mentor availability is independent of having personally pivoted -- a
  // lifelong domain expert who never changed careers is often exactly the
  // right person to talk to, not just people who made the same jump.
  const { data: mentors } = await supabase
    .from('profiles')
    .select('id, full_name, location, is_pivoter, pivot_status, pivot_from_domain, pivot_to_domain, mentor_domain, mentor_note, is_reentry, reentry_reason')
    .eq('is_mentor', true)
    .order('created_at', { ascending: false })
    .limit(50)

  // Cross-app read: gigs' own SELECT RLS is status='active' with no
  // ownership restriction, so any authenticated read gets the same rows
  // regardless of which app it's queried from -- same convention as
  // other cross-pillar reads elsewhere on this platform
  // (greyin_scores/reputation_scores). Only bookable-session gigs
  // matter here, not FlexPro's regular marketplace listings.
  const mentorIds = (mentors || []).map((m) => m.id)
  const { data: bookableGigs } = mentorIds.length
    ? await supabase
        .from('gigs')
        .select('freelancer_id')
        .in('freelancer_id', mentorIds)
        .eq('is_mentor_session', true)
        .eq('status', 'active')
    : { data: [] }
  const bookableMentorIds = new Set((bookableGigs || []).map((g) => g.freelancer_id))

  const effectiveDomain = (m: { mentor_domain: string | null; is_pivoter: boolean; pivot_status: string | null; pivot_to_domain: string | null }) =>
    m.mentor_domain || (m.is_pivoter && m.pivot_status === 'completed' ? m.pivot_to_domain : null)

  // Someone actively seeking a matching domain sees relevant mentors
  // first -- everyone else just gets the full mentor list.
  const sortedMentors = [...(mentors || [])].sort((a, b) => {
    if (!myTargetDomain) return 0
    const aMatch = (effectiveDomain(a) || '').toLowerCase().includes(myTargetDomain.toLowerCase())
    const bMatch = (effectiveDomain(b) || '').toLowerCase().includes(myTargetDomain.toLowerCase())
    if (aMatch && !bMatch) return -1
    if (bMatch && !aMatch) return 1
    return 0
  })

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="h-7 w-7 text-purple-600 dark:text-purple-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Find a Mentor</h1>
        </div>
        <p className="text-gray-600 mb-6 dark:text-gray-400">
          Members willing to help someone entering their domain — whether they pivoted into it themselves
          or have been there all along.
        </p>

        {sortedMentors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedMentors.map((mentor) => {
              const domain = effectiveDomain(mentor)
              const pivoted = mentor.is_pivoter && mentor.pivot_status === 'completed'
              return (
                <div key={mentor.id} className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center dark:bg-purple-950/40">
                      <User className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-50">{mentor.full_name || 'Member'}</h3>
                      {mentor.location && <p className="text-sm text-gray-500 dark:text-gray-400">{mentor.location}</p>}
                    </div>
                  </div>
                  {pivoted ? (
                    <p className="flex items-center gap-1 text-xs font-semibold text-orange-700 mb-2 dark:text-orange-400">
                      <Shuffle className="h-3.5 w-3.5" />
                      Pivoted: {mentor.pivot_from_domain || '—'} → {mentor.pivot_to_domain || '—'}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 text-xs font-semibold text-purple-700 mb-2 dark:text-purple-400">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Domain expert: {domain || '—'}
                    </p>
                  )}
                  {mentor.is_reentry && (
                    <p className="flex items-center gap-1 text-xs font-medium text-blue-700 mb-2 dark:text-blue-400">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Returned to work after a gap
                    </p>
                  )}
                  {mentor.mentor_note && <p className="text-sm text-gray-600 line-clamp-3 mb-2 dark:text-gray-400">{mentor.mentor_note}</p>}
                  <div className="flex items-center gap-4 mt-3">
                    {user && user.id !== mentor.id && (
                      <form action="/api/messages/start" method="POST">
                        <input type="hidden" name="other_user_id" value={mentor.id} />
                        <button
                          type="submit"
                          className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Message
                        </button>
                      </form>
                    )}
                    {bookableMentorIds.has(mentor.id) && (
                      <a
                        href={`https://flexpro.greyin.net/mentor-sessions?mentor=${mentor.id}`}
                        className="flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                      >
                        <CalendarClock className="h-4 w-4" />
                        Book a session
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
            <GraduationCap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-gray-50">No mentors listed yet</h3>
            <p className="text-gray-600 dark:text-gray-400">Verified Expert? List yourself under Mentor Availability on your Greyin profile to show up here.</p>
          </div>
        )}
      </div>
    </main>
  )
}
