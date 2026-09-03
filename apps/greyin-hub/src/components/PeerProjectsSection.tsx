import { Briefcase, Star, UserCheck, Info } from 'lucide-react'
import { TeammateTagPicker } from './TeammateTagPicker'

// Performance-review-style labels for the 1-5 contribution_rating scale
// (peer_project_ratings), shown wherever a rating is given or displayed --
// "5" alone means nothing to a rater or a reader; "Exceeded expectations"
// does. The underlying stored value stays a plain 1-5 integer (feeds
// peer_score and peer_rater_reliability's numeric aggregates); this is
// purely a display label, not a schema change.
export const CONTRIBUTION_RATING_LABELS: Record<number, string> = {
  1: 'Did not meet expectations',
  2: 'Below expectations',
  3: 'Met expectations',
  4: 'Strong contribution',
  5: 'Exceeded expectations',
}

export interface PendingTag {
  id: string
  projectTitle: string
  projectCompany: string
  creatorName: string | null
}

export interface PeerProjectView {
  id: string
  title: string
  company: string
  description: string | null
  confirmedMembers: { userId: string; name: string | null }[]
}

/**
 * Deliberately never labeled "verified" anywhere in this component --
 * see 089_peer_projects.sql's header comment. "Peer-confirmed" is the
 * only term used, kept visually distinct from the platform-verified
 * Greyin Score shown just above this section on the dashboard.
 */
export function PeerProjectsSection({
  currentUserId,
  pendingTags,
  projects,
  alreadyRatedPairs,
}: {
  currentUserId: string
  pendingTags: PendingTag[]
  projects: PeerProjectView[]
  alreadyRatedPairs: Set<string>
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <Briefcase className="w-5 h-5" />
        Peer-confirmed projects
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Work from before or outside Greyin, added by you and confirmed by real teammates who were there too --
        kept separate from your platform-verified Greyin Score, never called &ldquo;verified&rdquo; itself.
      </p>

      {pendingTags.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Awaiting your response</h3>
          <div className="space-y-2">
            {pendingTags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between border border-amber-200 bg-amber-50 rounded-lg px-4 py-3">
                <p className="text-sm text-gray-800">
                  <span className="font-medium">{tag.creatorName || 'Someone'}</span> tagged you on{' '}
                  <span className="font-medium">&ldquo;{tag.projectTitle}&rdquo;</span> at {tag.projectCompany}
                </p>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <form action="/api/peer-projects/members/respond" method="POST">
                    <input type="hidden" name="member_id" value={tag.id} />
                    <input type="hidden" name="status" value="confirmed" />
                    <button type="submit" className="text-sm font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
                      Confirm
                    </button>
                  </form>
                  <form action="/api/peer-projects/members/respond" method="POST">
                    <input type="hidden" name="member_id" value={tag.id} />
                    <input type="hidden" name="status" value="declined" />
                    <button type="submit" className="text-sm font-medium border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mb-6 space-y-4">
          {projects.map((project) => (
            <div key={project.id} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">{project.title}</h3>
              <p className="text-sm text-gray-500 mb-2">{project.company}</p>
              {project.description && <p className="text-sm text-gray-600 mb-3">{project.description}</p>}
              <div className="flex flex-wrap gap-2">
                {project.confirmedMembers.filter((m) => m.userId !== currentUserId).map((member) => {
                  const alreadyRated = alreadyRatedPairs.has(`${project.id}:${member.userId}`)
                  return (
                    <div key={member.userId} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-1.5">
                      <UserCheck className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-800">{member.name || 'A teammate'}</span>
                      {alreadyRated ? (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-current" /> Rated
                        </span>
                      ) : (
                        <form action="/api/peer-projects/ratings/create" method="POST" className="flex items-center gap-1">
                          <input type="hidden" name="project_id" value={project.id} />
                          <input type="hidden" name="ratee_id" value={member.userId} />
                          <span
                            className="flex-shrink-0 cursor-help"
                            title="Rate honestly. If you and a teammate both rate each other highly, this project gets flagged for employers as a possible reciprocal rating -- and shows up on both your profiles as a grade-inflation pattern."
                          >
                            <Info className="h-3.5 w-3.5 text-gray-400" aria-label="Rating honesty notice" />
                          </span>
                          <select name="contribution_rating" defaultValue="5" className="text-xs border border-gray-200 rounded px-1 py-0.5">
                            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{CONTRIBUTION_RATING_LABELS[n]}</option>)}
                          </select>
                          <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Rate</button>
                        </form>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <details className="border-t border-gray-200 pt-4">
        <summary className="text-sm font-medium text-indigo-600 cursor-pointer hover:text-indigo-700">Add a project</summary>
        <form action="/api/peer-projects/create" method="POST" className="mt-4 space-y-4">
          <div>
            <label htmlFor="peer-project-title" className="block text-sm font-medium text-gray-700 mb-1">Project title</label>
            <input id="peer-project-title" name="title" type="text" required className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="peer-project-company" className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input id="peer-project-company" name="company" type="text" required className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="peer-project-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea id="peer-project-description" name="description" rows={2} className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="peer-project-started" className="block text-sm font-medium text-gray-700 mb-1">Started</label>
              <input id="peer-project-started" name="started_on" type="date" className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
            <div>
              <label htmlFor="peer-project-ended" className="block text-sm font-medium text-gray-700 mb-1">Ended</label>
              <input id="peer-project-ended" name="ended_on" type="date" className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>
          </div>
          <TeammateTagPicker currentUserId={currentUserId} />
          <p className="text-xs text-gray-500">
            Teammates you tag will see a request to confirm they were really on this project with you --
            nothing shows on either profile until they do.
          </p>
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700">
            Add project
          </button>
        </form>
      </details>
    </div>
  )
}
