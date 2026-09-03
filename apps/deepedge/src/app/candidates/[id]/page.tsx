import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, ArrowLeft, BadgeCheck, Lock, RotateCcw, MapPin, ThumbsUp, BookOpen } from 'lucide-react'

const RELATIONSHIP_LABEL: Record<string, string> = {
  in_platform_task: 'Worked together on a Greyin project/gig',
  ex_colleague: 'Former colleague',
  current_colleague: 'Current colleague',
  other: 'Other professional relationship',
}
const PILLAR_LABEL: Record<string, string> = { stackworks: 'StackWorks', flexpro: 'FlexPro' }

// `id` is the person's own profiles.id (== auth.uid()), not candidates.id
// -- matching skill_endorsements/written_recommendations/
// professional_references, which all key off profiles.id, and every API
// route this page posts to, which all redirect back here with a
// profiles.id. /candidates' own search results link here the same way.
export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/candidates/${id}`)
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, user_id, current_title, current_company, skills, experience_years, availability, remote_preference, education, portfolio_url, expected_salary_min, expected_salary_max, currency, willing_to_relocate, profiles ( full_name, location, avatar_url, is_reentry, reentry_reason )')
    .eq('user_id', id)
    .maybeSingle()

  if (!candidate) {
    notFound()
  }

  const isSelf = user.id === id

  // Employers get the same binary subscription gate /candidates (the
  // search list) uses -- *unless* this specific candidate has a real
  // application to one of the employer's own job postings, matching that
  // page's own "reviewing applicants to your own postings stays free"
  // rule (see its banner comment). A non-employer viewer (a peer, or the
  // candidate themselves) never hits this gate at all -- no paywall on
  // top of being logged in.
  let isOwnApplicant = false
  if (profile?.role === 'employer') {
    const { data: company } = await supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle()
    if (company) {
      const { data: myJobs } = await supabase.from('jobs').select('id').eq('company_id', company.id)
      const jobIds = (myJobs || []).map((j) => j.id)
      if (jobIds.length > 0) {
        const { count } = await supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('candidate_id', candidate.id)
          .in('job_id', jobIds)
        isOwnApplicant = (count || 0) > 0
      }
    }

    if (!isOwnApplicant) {
      const { data: subscription } = company
        ? await supabase.from('company_subscriptions').select('status, current_period_end').eq('company_id', company.id).maybeSingle()
        : { data: null }
      const hasActiveSubscription = !!subscription
        && subscription.status === 'active'
        && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())
      if (!hasActiveSubscription) {
        redirect('/subscribe')
      }
    }
  }

  const { data: scoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score')
    .eq('user_id', candidate.user_id)
    .maybeSingle()

  // Credit metering (096) is the same "genuine proactive search" concept
  // as the subscription gate above -- an own-applicant view and any
  // non-employer view are both free of it too, for the same reason.
  let canView = true
  if (profile?.role === 'employer' && !isOwnApplicant) {
    const { data } = await supabase.rpc('consume_credit', {
      p_user_id: user.id,
      p_product: 'deepedge_hiring',
      p_credit_type: 'profile_view',
    })
    canView = !!data
  }

  const candidateProfile = (candidate as any).profiles

  // Everything below is read for any eligible viewer -- collaboration
  // status (skill endorsements / written recommendations are gated to a
  // real collaborators (059) tie, same evidence FlexPro completed-order
  // history feeds), the candidate's own reference list (employer-visible
  // slice only, per professional_references' own RLS), and their
  // published GreyMatters articles (competitive audit, Aug 2026 -- reach
  // beyond GreyMatters itself is the point, not writing capability).
  let isCollaborator = false
  const endorsementsBySkill = new Map<string, string[]>()
  let recommendations: any[] = []
  let alreadyReferenced = false
  let referencesForEmployer: any[] = []
  const requestedByReferenceId = new Map<string, { id: string; status: string }>()
  const responseByReferenceId = new Map<string, string>()
  let articles: any[] = []

  if (canView) {
    if (!isSelf) {
      const { data: collabRows } = await supabase
        .from('collaborators')
        .select('collaborator_id')
        .eq('user_id', user.id)
        .eq('collaborator_id', id)
        .limit(1)
      isCollaborator = (collabRows || []).length > 0
    }

    const { data: endorsementRows } = await supabase
      .from('skill_endorsements')
      .select('endorser_id, skill')
      .eq('endorsee_id', id)
    for (const e of endorsementRows || []) {
      const arr = endorsementsBySkill.get(e.skill) || []
      arr.push(e.endorser_id)
      endorsementsBySkill.set(e.skill, arr)
    }

    const { data: recRows } = await supabase
      .from('written_recommendations')
      .select('id, recommender_id, body, profiles:recommender_id ( full_name )')
      .eq('recommendee_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    recommendations = recRows || []

    if (!isSelf && profile?.role !== 'employer') {
      const { data: existingRef } = await supabase
        .from('professional_references')
        .select('id')
        .eq('candidate_id', user.id)
        .eq('reference_user_id', id)
        .maybeSingle()
      alreadyReferenced = !!existingRef
    }

    if (profile?.role === 'employer') {
      const { data: refRows } = await supabase
        .from('professional_references')
        .select('id, relationship_type, relationship_detail, verified_pillar')
        .eq('candidate_id', id)
      referencesForEmployer = refRows || []

      const referenceIds = referencesForEmployer.map((r) => r.id)
      const { data: reqRows } = referenceIds.length
        ? await supabase
            .from('reference_requests')
            .select('id, reference_id, status')
            .eq('requested_by', user.id)
            .in('reference_id', referenceIds)
        : { data: [] }
      for (const r of reqRows || []) requestedByReferenceId.set(r.reference_id, r)

      const requestIds = (reqRows || []).map((r) => r.id)
      const { data: respRows } = requestIds.length
        ? await supabase.from('reference_responses').select('request_id, body').in('request_id', requestIds)
        : { data: [] }
      for (const resp of respRows || []) {
        const req = (reqRows || []).find((r) => r.id === resp.request_id)
        if (req) responseByReferenceId.set(req.reference_id, resp.body)
      }
    }

    const { data: postRows } = await supabase
      .from('posts')
      .select('id, title, slug, excerpt, published_at')
      .eq('author_id', id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    articles = postRows || []
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Building2 className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/candidates" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to candidates
        </Link>

        {!canView ? (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-7 w-7 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Out of profile views for this month</h1>
            <p className="text-gray-600 mb-8">
              Your current tier's monthly candidate profile view allowance is used up. Upgrade to a higher
              tier to view more Verified Expert profiles.
            </p>
            <Link href="/subscribe" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
              Upgrade tier
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                  <Building2 className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{candidateProfile?.full_name || 'Candidate'}</h1>
                  <p className="text-gray-600">{candidate.current_title || 'No title provided'}{candidate.current_company ? ` at ${candidate.current_company}` : ''}</p>
                  {candidateProfile?.location && (
                    <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {candidateProfile.location}
                    </p>
                  )}
                </div>
              </div>

              <p className="flex items-center gap-1 text-sm font-semibold text-indigo-700 mb-4">
                <BadgeCheck className="h-4 w-4" />
                Verified Expert{scoreRow?.greyin_score != null ? ` · Greyin Score ${scoreRow.greyin_score}` : ''}
              </p>

              {candidateProfile?.is_reentry && (
                <p className="flex items-center gap-1 text-sm font-medium text-blue-700 mb-4">
                  <RotateCcw className="h-4 w-4" />
                  Returning to work{candidateProfile.reentry_reason ? ` · ${candidateProfile.reentry_reason}` : ''}
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-700 mb-6 border-t border-b py-4">
                {candidate.experience_years != null && <p><span className="text-gray-500">Experience:</span> {candidate.experience_years} yrs</p>}
                {candidate.availability && <p className="capitalize"><span className="text-gray-500">Availability:</span> {candidate.availability.replace('_', ' ')}</p>}
                {candidate.remote_preference && <p className="capitalize"><span className="text-gray-500">Remote preference:</span> {candidate.remote_preference}</p>}
                {candidate.education && <p><span className="text-gray-500">Education:</span> {candidate.education}</p>}
                {(candidate.expected_salary_min || candidate.expected_salary_max) && (
                  <p><span className="text-gray-500">Expected salary:</span> {candidate.currency} {candidate.expected_salary_min?.toLocaleString() || '—'}–{candidate.expected_salary_max?.toLocaleString() || '—'}</p>
                )}
                <p><span className="text-gray-500">Open to relocation:</span> {candidate.willing_to_relocate ? 'Yes' : 'No'}</p>
                {candidate.portfolio_url && (
                  <p><span className="text-gray-500">Portfolio:</span> <a href={candidate.portfolio_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{candidate.portfolio_url}</a></p>
                )}
              </div>

              {candidate.skills && candidate.skills.length > 0 && (
                <>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2">Skills</h2>
                  <div className="flex flex-col gap-2">
                    {candidate.skills.map((s: string) => {
                      const endorsers = endorsementsBySkill.get(s) || []
                      const count = endorsers.length
                      const viewerEndorsed = endorsers.includes(user.id)
                      return (
                        <div key={s} className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">{s}</span>
                          {viewerEndorsed ? (
                            <form action={`/api/skills/${id}/unendorse`} method="POST">
                              <input type="hidden" name="skill" value={s} />
                              <button type="submit" className="flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900" title="You endorsed this -- click to remove">
                                <ThumbsUp className="h-3 w-3" /> {count}
                              </button>
                            </form>
                          ) : isCollaborator ? (
                            <form action={`/api/skills/${id}/endorse`} method="POST">
                              <input type="hidden" name="skill" value={s} />
                              <button type="submit" className="text-xs font-semibold text-indigo-600 hover:underline">Endorse</button>
                            </form>
                          ) : (
                            <span className="text-xs text-gray-500">{count} endorsement{count === 1 ? '' : 's'}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {!isSelf && !isCollaborator && (
                    <p className="text-xs text-gray-400 mt-2">Endorsing requires a real collaboration with this person -- a completed FlexPro gig, or a shared StackWorks project.</p>
                  )}
                </>
              )}
            </div>

            {/* Written recommendations -- approved ones are public; a real
                collaborator who hasn't already vouched gets the form. */}
            <div className="bg-white rounded-lg shadow-md p-8 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
              {recommendations.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="border-l-2 border-indigo-100 pl-4">
                      <p className="text-sm text-gray-700">{rec.body}</p>
                      <p className="text-xs text-gray-500 mt-1">— {rec.profiles?.full_name || 'A collaborator'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-6">No recommendations yet.</p>
              )}

              {!isSelf && (
                isCollaborator ? (
                  <form action="/api/recommendations/create" method="POST" className="border-t pt-4">
                    <input type="hidden" name="recommendee_id" value={id} />
                    <label htmlFor="recommendation-body" className="block text-sm font-medium text-gray-700 mb-2">Write a recommendation</label>
                    <textarea id="recommendation-body" name="body" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2" />
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">Submit</button>
                  </form>
                ) : (
                  <p className="text-xs text-gray-400 border-t pt-4">Writing a recommendation requires a real collaboration with this person -- a completed FlexPro gig, or a shared StackWorks project.</p>
                )
              )}
            </div>

            {/* Adding this person as one of *your own* references --
                deliberately not collaboration-gated (065's own comment:
                the common real case is an ex-colleague with no in-platform
                tie at all), managed afterward from /profile. */}
            {!isSelf && profile?.role !== 'employer' && (
              <div className="bg-white rounded-lg shadow-md p-8 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Add as a reference</h2>
                {alreadyReferenced ? (
                  <p className="text-sm text-gray-500">You've already added this person as a reference.</p>
                ) : (
                  <form action="/api/references/create" method="POST" className="space-y-3">
                    <input type="hidden" name="reference_user_id" value={id} />
                    <select name="relationship_type" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" defaultValue="">
                      <option value="" disabled>How do you know them?</option>
                      <option value="in_platform_task">Worked together on a Greyin project/gig</option>
                      <option value="ex_colleague">Former colleague</option>
                      <option value="current_colleague">Current colleague</option>
                      <option value="other">Other professional relationship</option>
                    </select>
                    <textarea name="relationship_detail" rows={2} placeholder="Briefly, how did you work together?" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">Add as reference</button>
                  </form>
                )}
              </div>
            )}

            {/* Employer-only: this candidate's reference list, visible
                because a real application ties them together
                (professional_references' own RLS enforces this, not just
                the UI) -- with a per-reference "request a check" action. */}
            {profile?.role === 'employer' && referencesForEmployer.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-8 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">References</h2>
                <div className="space-y-3">
                  {referencesForEmployer.map((ref) => {
                    const request = requestedByReferenceId.get(ref.id)
                    const responseBody = responseByReferenceId.get(ref.id)
                    return (
                      <div key={ref.id} className="border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                          {RELATIONSHIP_LABEL[ref.relationship_type] || ref.relationship_type} — {ref.relationship_detail}
                        </p>
                        {ref.verified_pillar && (
                          <p className="text-xs text-green-700 mt-0.5">
                            Greyin-verified: worked together via {PILLAR_LABEL[ref.verified_pillar] || ref.verified_pillar}
                          </p>
                        )}
                        {responseBody ? (
                          <p className="text-sm text-gray-800 mt-3 bg-gray-50 rounded p-3">{responseBody}</p>
                        ) : request ? (
                          <p className="text-xs text-gray-500 mt-3">Request sent — waiting on a response.</p>
                        ) : (
                          <form action="/api/references/request" method="POST" className="mt-3">
                            <input type="hidden" name="reference_id" value={ref.id} />
                            <input type="hidden" name="candidate_profile_id" value={id} />
                            <button type="submit" className="text-xs font-semibold text-indigo-600 hover:underline">Request a reference check</button>
                          </form>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* GreyMatters cross-posting (competitive audit, Aug 2026):
                the gap against Medium is reach, not writing capability --
                a candidate's published articles surface here, where an
                employer is actually looking. */}
            {articles.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-8">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4">
                  <BookOpen className="h-5 w-5 text-sky-600" />
                  Authored articles on GreyMatters
                </h2>
                <div className="space-y-3">
                  {articles.map((a) => (
                    <a key={a.id} href={`https://greymatters.greyin.net/posts/${a.slug}`} target="_blank" rel="noreferrer" className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded">
                      <p className="text-sm font-medium text-sky-700">{a.title}</p>
                      {a.excerpt && <p className="text-xs text-gray-500 mt-0.5">{a.excerpt}</p>}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
