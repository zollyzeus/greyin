import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, ArrowLeft, BadgeCheck, Lock, RotateCcw, MapPin, ThumbsUp, BookOpen, Users, Sparkles } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { buildSkillDossier } from '@/lib/skill-dossier'

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

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  const { data: viewerScoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  // The target person's own profile, fetched independently of `candidates`
  // -- this page is also the profile view for peer-project collaborators
  // tagged from Salt & Pepper/StackWorks/etc, most of whom never went
  // through DeepEdge's own candidate signup and so have no `candidates`
  // row at all (handle_new_user only inserts one for role='candidate').
  // `candidate` below is optional; only its DeepEdge-specific fields
  // (title, skills, salary...) are gated on it existing.
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('full_name, location, avatar_url, is_reentry, reentry_reason')
    .eq('id', id)
    .maybeSingle()

  if (!targetProfile) {
    notFound()
  }

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, current_title, current_company, skills, experience_years, availability, remote_preference, education, portfolio_url, expected_salary_min, expected_salary_max, currency, willing_to_relocate')
    .eq('user_id', id)
    .maybeSingle()

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
    if (company && candidate) {
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
    .eq('user_id', id)
    .maybeSingle()

  // AI-Synthesized Verified Profile (Phase C1, "11 new AI enhancements"
  // plan) -- reads the same real evidence greyin_scores aggregates to
  // produce a narrative synthesis. Live/on-demand, no new table.
  const skillDossier = await buildSkillDossier(id)

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

  const candidateProfile = targetProfile

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
  let referenceReport: { consistency: string; summary: string; notes: string | null; response_count: number } | null = null
  let articles: any[] = []
  // RESTORED (2026-09-04, integrity audit): FR-PW-26's own "Employer
  // view: rating pattern" panel + per-project reciprocity badge shipped
  // in 090/091, verified by peer-projects.spec.ts, but this page's
  // 2026-09-02/03 rebuild-from-scratch never carried them forward --
  // that rebuild's own scope was a different, unrelated set of 5 specs,
  // and this one was never re-checked afterward. peerProjects itself
  // (the public list) is public for any eligible viewer; peerRaterStats
  // and reciprocityFlagsByProject are additionally gated in app code on
  // top of the real enforcement, which is peer_rater_reliability's and
  // peer_project_reciprocity_flags' own WHERE EXISTS(...role IN
  // ('employer','admin')) clauses baked into each view -- a non-employer
  // querying either gets back zero rows regardless of what this page does.
  let peerProjects: any[] = []
  let peerRaterStats: any = null
  const reciprocityFlagsByProject = new Set<string>()

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

      // AI-synthesized reference report (117) -- generated server-side
      // once >=2 responses exist for this (candidate, employer) pair, see
      // lib/reference-synthesis.ts. Confidential to this employer, same
      // as the raw responses it summarizes.
      const { data: report } = await supabase
        .from('ai_reference_reports')
        .select('consistency, summary, notes, response_count')
        .eq('candidate_id', id)
        .eq('requested_by', user.id)
        .maybeSingle()
      referenceReport = report || null
    }

    const { data: postRows } = await supabase
      .from('posts')
      .select('id, title, slug, excerpt, published_at')
      .eq('author_id', id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    articles = postRows || []

    const { data: memberRows } = await supabase
      .from('peer_project_members')
      .select('peer_projects ( id, title, company, description )')
      .eq('user_id', id)
      .eq('status', 'confirmed')
    peerProjects = (memberRows || [])
      .map((r: any) => r.peer_projects)
      .filter(Boolean)

    if (profile?.role === 'employer' || profile?.role === 'admin') {
      const { data: reliabilityRow } = await supabase
        .from('peer_rater_reliability')
        .select('*')
        .eq('rater_id', id)
        .maybeSingle()
      peerRaterStats = reliabilityRow

      if (peerProjects.length > 0) {
        const projectIds = peerProjects.map((p: any) => p.id)
        const { data: flagRows } = await supabase
          .from('peer_project_reciprocity_flags')
          .select('project_id')
          .in('project_id', projectIds)
          .or(`person_a.eq.${id},person_b.eq.${id}`)
        for (const f of flagRows || []) reciprocityFlagsByProject.add(f.project_id)
      }
    }
  }

  return (
    <WorkspaceShell
      variant={profile?.role === 'employer' ? 'employer' : 'candidate'}
      activeSection="candidates"
      userName={profile?.full_name || 'User'}
      verified={!!viewerScoreRow?.is_verified_expert}
      greyinScore={viewerScoreRow?.greyin_score ?? null}
      pageTitle="Candidate Profile"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/candidates" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to candidates
        </Link>

        {!canView ? (
          <div className="bg-white rounded-2xl shadow-md p-10 text-center dark:bg-gray-900">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-indigo-950/40">
              <Lock className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 dark:text-gray-50">Out of profile views for this month</h1>
            <p className="text-gray-600 mb-8 dark:text-gray-400">
              Your current tier's monthly candidate profile view allowance is used up. Upgrade to a higher
              tier to view more Verified Expert profiles.
            </p>
            <Link href="/subscribe" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
              Upgrade tier
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center shrink-0 dark:bg-gray-800">
                  <Building2 className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{candidateProfile?.full_name || 'Candidate'}</h1>
                  {candidate && (
                    <p className="text-gray-600 dark:text-gray-400">{candidate.current_title || 'No title provided'}{candidate.current_company ? ` at ${candidate.current_company}` : ''}</p>
                  )}
                  {candidateProfile?.location && (
                    <p className="flex items-center gap-1 text-sm text-gray-500 mt-1 dark:text-gray-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {candidateProfile.location}
                    </p>
                  )}
                </div>
              </div>

              <p className="flex items-center gap-1 text-sm font-semibold text-indigo-700 mb-4 dark:text-indigo-400">
                <BadgeCheck className="h-4 w-4" />
                Verified Expert{scoreRow?.greyin_score != null ? ` · Greyin Score ${scoreRow.greyin_score}` : ''}
              </p>

              {candidateProfile?.is_reentry && (
                <p className="flex items-center gap-1 text-sm font-medium text-blue-700 mb-4 dark:text-blue-400">
                  <RotateCcw className="h-4 w-4" />
                  Returning to work{candidateProfile.reentry_reason ? ` · ${candidateProfile.reentry_reason}` : ''}
                </p>
              )}

              {candidate && (
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-700 mb-6 border-t border-b py-4 dark:text-gray-300">
                {candidate.experience_years != null && <p><span className="text-gray-500 dark:text-gray-400">Experience:</span> {candidate.experience_years} yrs</p>}
                {candidate.availability && <p className="capitalize"><span className="text-gray-500 dark:text-gray-400">Availability:</span> {candidate.availability.replace('_', ' ')}</p>}
                {candidate.remote_preference && <p className="capitalize"><span className="text-gray-500 dark:text-gray-400">Remote preference:</span> {candidate.remote_preference}</p>}
                {candidate.education && <p><span className="text-gray-500 dark:text-gray-400">Education:</span> {candidate.education}</p>}
                {(candidate.expected_salary_min || candidate.expected_salary_max) && (
                  <p><span className="text-gray-500 dark:text-gray-400">Expected salary:</span> {candidate.currency} {candidate.expected_salary_min?.toLocaleString() || '—'}–{candidate.expected_salary_max?.toLocaleString() || '—'}</p>
                )}
                <p><span className="text-gray-500 dark:text-gray-400">Open to relocation:</span> {candidate.willing_to_relocate ? 'Yes' : 'No'}</p>
                {candidate.portfolio_url && (
                  <p><span className="text-gray-500 dark:text-gray-400">Portfolio:</span> <a href={candidate.portfolio_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">{candidate.portfolio_url}</a></p>
                )}
              </div>
              )}

              {skillDossier && (
                <details className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 dark:bg-indigo-950/30 dark:border-indigo-900">
                  <summary className="flex items-center gap-2 text-sm font-semibold text-indigo-700 cursor-pointer select-none dark:text-indigo-400">
                    <Sparkles className="h-4 w-4" />
                    AI-Synthesized Verified Profile
                  </summary>
                  <p className="text-sm text-gray-700 mt-3 whitespace-pre-line dark:text-gray-300">{skillDossier}</p>
                </details>
              )}

              {candidate?.skills && candidate.skills.length > 0 && (
                <>
                  <h2 className="text-sm font-semibold text-gray-900 mb-2 dark:text-gray-50">Skills</h2>
                  <div className="flex flex-col gap-2">
                    {candidate.skills.map((s: string) => {
                      const endorsers = endorsementsBySkill.get(s) || []
                      const count = endorsers.length
                      const viewerEndorsed = endorsers.includes(user.id)
                      return (
                        <div key={s} className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium dark:bg-indigo-950/40 dark:text-indigo-400">{s}</span>
                          {viewerEndorsed ? (
                            <form action={`/api/skills/${id}/unendorse`} method="POST">
                              <input type="hidden" name="skill" value={s} />
                              <button type="submit" className="flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 dark:text-indigo-400" title="You endorsed this -- click to remove">
                                <ThumbsUp className="h-3 w-3" /> {count}
                              </button>
                            </form>
                          ) : isCollaborator ? (
                            <form action={`/api/skills/${id}/endorse`} method="POST">
                              <input type="hidden" name="skill" value={s} />
                              <button type="submit" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Endorse</button>
                            </form>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{count} endorsement{count === 1 ? '' : 's'}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {!isSelf && !isCollaborator && (
                    <p className="text-xs text-gray-400 mt-2 dark:text-gray-500">Endorsing requires a real collaboration with this person -- a completed FlexPro gig, or a shared StackWorks project.</p>
                  )}
                </>
              )}
            </div>

            {/* Written recommendations -- approved ones are public; a real
                collaborator who hasn't already vouched gets the form. */}
            <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">Recommendations</h2>
              {recommendations.length > 0 ? (
                <div className="space-y-4 mb-6">
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="border-l-2 border-indigo-100 pl-4">
                      <p className="text-sm text-gray-700 dark:text-gray-300">{rec.body}</p>
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">— {rec.profiles?.full_name || 'A collaborator'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">No recommendations yet.</p>
              )}

              {!isSelf && (
                isCollaborator ? (
                  <form action="/api/recommendations/create" method="POST" className="border-t pt-4">
                    <input type="hidden" name="recommendee_id" value={id} />
                    <label htmlFor="recommendation-body" className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Write a recommendation</label>
                    <textarea id="recommendation-body" name="body" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">Submit</button>
                  </form>
                ) : (
                  <p className="text-xs text-gray-400 border-t pt-4 dark:text-gray-500">Writing a recommendation requires a real collaboration with this person -- a completed FlexPro gig, or a shared StackWorks project.</p>
                )
              )}
            </div>

            {/* Adding this person as one of *your own* references --
                deliberately not collaboration-gated (065's own comment:
                the common real case is an ex-colleague with no in-platform
                tie at all), managed afterward from /profile. */}
            {!isSelf && profile?.role !== 'employer' && (
              <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">Add as a reference</h2>
                {alreadyReferenced ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">You've already added this person as a reference.</p>
                ) : (
                  <form action="/api/references/create" method="POST" className="space-y-3">
                    <input type="hidden" name="reference_user_id" value={id} />
                    <select name="relationship_type" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" defaultValue="">
                      <option value="" disabled>How do you know them?</option>
                      <option value="in_platform_task">Worked together on a Greyin project/gig</option>
                      <option value="ex_colleague">Former colleague</option>
                      <option value="current_colleague">Current colleague</option>
                      <option value="other">Other professional relationship</option>
                    </select>
                    <textarea name="relationship_detail" rows={2} placeholder="Briefly, how did you work together?" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
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
              <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">References</h2>
                {referenceReport && (
                  <div className={`rounded-lg p-4 mb-4 border ${referenceReport.consistency === 'notable_differences' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' : 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${referenceReport.consistency === 'notable_differences' ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                      AI reference summary · {referenceReport.consistency === 'notable_differences' ? 'Notable differences to review' : 'Consistent across references'}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{referenceReport.summary}</p>
                    {referenceReport.notes && referenceReport.notes !== 'None.' && (
                      <p className="text-sm text-gray-700 mt-2 dark:text-gray-300">{referenceReport.notes}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">Based on {referenceReport.response_count} responses. AI-generated — always read the full responses below yourself.</p>
                  </div>
                )}
                <div className="space-y-3">
                  {referencesForEmployer.map((ref) => {
                    const request = requestedByReferenceId.get(ref.id)
                    const responseBody = responseByReferenceId.get(ref.id)
                    return (
                      <div key={ref.id} className="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {RELATIONSHIP_LABEL[ref.relationship_type] || ref.relationship_type} — {ref.relationship_detail}
                        </p>
                        {ref.verified_pillar && (
                          <p className="text-xs text-green-700 mt-0.5 dark:text-green-400">
                            Greyin-verified: worked together via {PILLAR_LABEL[ref.verified_pillar] || ref.verified_pillar}
                          </p>
                        )}
                        {responseBody ? (
                          <p className="text-sm text-gray-800 mt-3 bg-gray-50 rounded p-3 dark:text-gray-100 dark:bg-gray-950">{responseBody}</p>
                        ) : request ? (
                          <p className="text-xs text-gray-500 mt-3 dark:text-gray-400">Request sent — waiting on a response.</p>
                        ) : (
                          <form action="/api/references/request" method="POST" className="mt-3">
                            <input type="hidden" name="reference_id" value={ref.id} />
                            <input type="hidden" name="candidate_profile_id" value={id} />
                            <button type="submit" className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Request a reference check</button>
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
              <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">
                  <BookOpen className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  Authored articles on GreyMatters
                </h2>
                <div className="space-y-3">
                  {articles.map((a) => (
                    <a key={a.id} href={`https://greymatters.greyin.net/posts/${a.slug}`} target="_blank" rel="noreferrer" className="block hover:bg-gray-50 -mx-2 px-2 py-1 rounded dark:hover:bg-gray-800">
                      <p className="text-sm font-medium text-sky-700 dark:text-sky-400">{a.title}</p>
                      {a.excerpt && <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{a.excerpt}</p>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* RESTORED (2026-09-04, integrity audit): see comment at the
                top of the canView block for why this was ever missing. */}
            {peerProjects.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-1 dark:text-gray-50">
                  <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Peer-confirmed projects
                </h2>
                <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
                  Work confirmed by real teammates, kept separate from the platform-verified Greyin Score above.
                </p>

                {peerRaterStats && (
                  <div className="mb-6 border border-amber-200 bg-amber-50 rounded-lg p-4 dark:border-amber-900 dark:bg-amber-950/40">
                    <h3 className="text-sm font-semibold text-amber-800 mb-1 dark:text-amber-300">
                      Employer view: rating pattern as a peer rater
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      {peerRaterStats.ratings_given_count} rating{peerRaterStats.ratings_given_count === 1 ? '' : 's'} given, average {peerRaterStats.avg_rating_given}/5
                      ({peerRaterStats.top_rating_pct}% top rating).
                      {peerRaterStats.mutual_pair_count > 0 && (
                        <> {peerRaterStats.mutual_high_rating_pct}% are part of a mutual pair where both sides rated each other 4 or higher.</>
                      )}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {peerProjects.map((project) => (
                    <div key={project.id} className="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-50">{project.title}</h3>
                        {reciprocityFlagsByProject.has(project.id) && (
                          <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full dark:bg-red-950/40 dark:text-red-400">
                            ⚠ Possible reciprocal rating
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{project.company}</p>
                      {project.description && <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">{project.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </WorkspaceShell>
  )
}
