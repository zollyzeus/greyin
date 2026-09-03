import { BadgeCheck, ExternalLink, User } from 'lucide-react'

export interface PersonResult {
  user_id: string
  full_name: string | null
  location: string | null
  greyin_score: number | null
  is_verified_expert: boolean | null
  verified_outcomes_count: number
  skills: string[]
  availability: string | null
  current_title: string | null
  is_mentor: boolean | null
  mentor_domain: string | null
}

/**
 * People-intent results from platform_people_index (060) — the
 * person-level analog of EcosystemSearchResults, which only knows
 * how to render content (posts/jobs/gigs/discussions/projects).
 * Every result links to DeepEdge's /candidates/[id], the one open,
 * cross-pillar-complete profile page on the platform, regardless of
 * which app the search happened in.
 */
export function PeopleSearchResults({ results }: { results: PersonResult[] }) {
  if (results.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">People on Greyin</h2>
      <div className="space-y-3">
        {results.map((p) => (
          <a
            key={p.user_id}
            href={`https://deepedge.greyin.net/candidates/${p.user_id}`}
            className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{p.full_name || 'Greyin member'}</h3>
                    {p.is_verified_expert && <BadgeCheck className="h-4 w-4 text-teal-600 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {p.current_title || (p.is_mentor ? `Mentor · ${p.mentor_domain || 'General'}` : null)}
                    {p.location ? ` · ${p.location}` : ''}
                  </p>
                  {p.skills.length > 0 && (
                    <p className="text-xs text-gray-400 truncate">{p.skills.slice(0, 5).join(', ')}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {p.verified_outcomes_count > 0 && (
                  <span className="text-xs font-medium text-green-700">
                    {p.verified_outcomes_count} verified
                  </span>
                )}
                {p.greyin_score != null && (
                  <span className="px-2 py-1 bg-gray-900 text-white rounded-lg text-xs font-bold">
                    {p.greyin_score}
                  </span>
                )}
                <ExternalLink className="h-4 w-4 text-gray-300" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
