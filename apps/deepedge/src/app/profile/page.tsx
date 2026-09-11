import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Phone, MapPin, Building2, Save, Globe, BadgeCheck, Shuffle, GraduationCap, RotateCcw, Link2 } from 'lucide-react'
import Link from 'next/link'
import { EcosystemWidget } from '@/components/EcosystemWidget'
import { ResumeSkillsUploader } from '@/components/ResumeSkillsUploader'
import { EmploymentHistoryEditor } from '@/components/EmploymentHistoryEditor'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { absoluteUrl } from '@/lib/site-url'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/profile')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await supabase
    .from('pillar_memberships')
    .select('pillar')
    .eq('user_id', user.id)

  const { data: mySkills } = await supabase
    .from('profile_skill_summary')
    .select('*')
    .eq('user_id', user.id)
    .order('skill')

  const { data: pendingRecommendations } = await supabase
    .from('written_recommendations')
    .select('id, body, created_at, profiles:recommender_id(full_name)')
    .eq('recommendee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // References this user has listed for their own candidacy
  // (065_reference_checks.sql) -- named from candidates/[id]'s "Add as
  // reference" form, managed here.
  const { data: myReferences } = await supabase
    .from('professional_references')
    .select('id, reference_user_id, relationship_type, relationship_detail, verified_pillar, profiles:reference_user_id(full_name)')
    .eq('candidate_id', user.id)
    .order('created_at', { ascending: false })

  // How many reference requests are waiting on this user to answer, as
  // someone else's named reference -- just a count/link here; answering
  // happens on /references/respond, which the candidate they're a
  // reference for never gets to see (private, employer-initiated).
  const { data: referencedFor } = await supabase
    .from('professional_references')
    .select('id')
    .eq('reference_user_id', user.id)
  const referencedForIds = (referencedFor || []).map((r) => r.id)
  const { count: pendingReferenceRequestCount } = referencedForIds.length
    ? await supabase
        .from('reference_requests')
        .select('id', { count: 'exact', head: true })
        .in('reference_id', referencedForIds)
        .eq('status', 'pending')
    : { count: 0 }

  const RELATIONSHIP_LABEL: Record<string, string> = {
    in_platform_task: 'Worked together on a Greyin project/gig',
    ex_colleague: 'Former colleague',
    current_colleague: 'Current colleague',
    other: 'Other professional relationship',
  }
  const PILLAR_LABEL: Record<string, string> = { stackworks: 'StackWorks', flexpro: 'FlexPro' }

  // Cross-app trust signals -- profiles already carries FlexPro's
  // seller_rating/total_reviews (fetched below via profile.*); the other
  // two need their own cross-app reads, same pattern stackworks already
  // uses against saltnpepper's builder_projects. Best-effort: someone
  // with no activity on a given pillar just shows nothing for it.
  const { data: verifiedOutcomes } = await supabase
    .from('verified_outcomes')
    .select('score')
    .eq('subject_user_id', user.id)
    .eq('status', 'verified')
  const { data: reputationRow } = await supabase
    .from('reputation_scores')
    .select('score')
    .eq('user_id', user.id)
    .maybeSingle()
  // Unified, Bayesian-shrunk, headcount-weighted composite of all three
  // signals above plus career experience (036) -- the single number,
  // the three fields above are its breakdown.
  const { data: greyinScoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, is_verified_expert, stackworks_score, stackworks_evidence, flexpro_score, flexpro_evidence, saltnpepper_score, saltnpepper_evidence, greymatters_score, greymatters_evidence, platform_composite, years_experience')
    .eq('user_id', user.id)
    .maybeSingle()
  const verifiedCount = verifiedOutcomes?.length || 0
  const verifiedAvg = verifiedCount > 0
    ? Math.round(verifiedOutcomes!.reduce((s, o) => s + (o.score || 0), 0) / verifiedCount)
    : null

  // Shareable Verified Score badge (Phase D2, 133_public_score_badges.sql)
  // -- opt-in only, so this stays absent until the user has ever toggled
  // it on once.
  const { data: badgeRow } = await supabase
    .from('public_score_badges')
    .select('slug, enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  // Check if user is employer/company
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Check if user is candidate
  const { data: candidate } = await supabase
    .from('candidates')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: employmentHistory } = candidate
    ? await supabase
        .from('candidate_employment_history')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('start_date', { ascending: false })
    : { data: [] }

  return (
    <WorkspaceShell
      variant={profile?.role === 'employer' ? 'employer' : 'candidate'}
      activeSection="profile"
      userName={profile?.full_name || 'User'}
      verified={!!greyinScoreRow?.is_verified_expert}
      greyinScore={greyinScoreRow?.greyin_score ?? null}
      pageTitle="My Profile"
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />

        {(verifiedCount > 0 || (profile?.total_reviews ?? 0) > 0 || (reputationRow?.score ?? 0) > 0) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BadgeCheck className="w-5 h-5" />
                Trust Signals
              </h2>
              {greyinScoreRow?.greyin_score != null && (
                <span className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm font-bold" title="Career experience + verified track record across all Greyin platforms">
                  Greyin Score: {greyinScoreRow.greyin_score}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {verifiedCount > 0 && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">StackWorks</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-50">{verifiedCount} verified outcome{verifiedCount === 1 ? '' : 's'} · avg {verifiedAvg}/100</p>
                </div>
              )}
              {(profile?.total_reviews ?? 0) > 0 && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">FlexPro</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-50">★ {profile.seller_rating?.toFixed(1)} ({profile.total_reviews} reviews)</p>
                </div>
              )}
              {(reputationRow?.score ?? 0) > 0 && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Salt &amp; Pepper</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-50">{reputationRow!.score} reputation</p>
                </div>
              )}
            </div>

            {greyinScoreRow?.greyin_score != null && (
              <details className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <summary className="text-xs font-medium text-indigo-600 cursor-pointer select-none dark:text-indigo-400">How is this calculated?</summary>
                <div className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <p>Each platform&apos;s raw average is shrunk toward the platform-wide mean based on how much evidence you have there, so one lucky 100 doesn&apos;t outrank someone with ten solid 80s:</p>
                  <ul className="pl-4 list-disc space-y-1">
                    {greyinScoreRow.stackworks_score != null && (
                      <li>StackWorks: {greyinScoreRow.stackworks_score}/100 (from {greyinScoreRow.stackworks_evidence} verified outcome{greyinScoreRow.stackworks_evidence === 1 ? '' : 's'})</li>
                    )}
                    {greyinScoreRow.flexpro_score != null && (
                      <li>FlexPro: {greyinScoreRow.flexpro_score}/100 (from {greyinScoreRow.flexpro_evidence} review{greyinScoreRow.flexpro_evidence === 1 ? '' : 's'})</li>
                    )}
                    {greyinScoreRow.saltnpepper_score != null && (
                      <li>Salt &amp; Pepper: {greyinScoreRow.saltnpepper_score}/100 (from {greyinScoreRow.saltnpepper_evidence} reputation event{greyinScoreRow.saltnpepper_evidence === 1 ? '' : 's'})</li>
                    )}
                    {greyinScoreRow.greymatters_score != null && (
                      <li>GreyMatters: {greyinScoreRow.greymatters_score}/100 (from {greyinScoreRow.greymatters_evidence} scored post{greyinScoreRow.greymatters_evidence === 1 ? '' : 's'})</li>
                    )}
                  </ul>
                  <p>Platform composite (headcount-weighted across whichever of the above you have): {greyinScoreRow.platform_composite}/100</p>
                  <p>Career experience: {Math.min(greyinScoreRow.years_experience ?? 0, 20)} of 20 capped years counted</p>
                  <p className="font-medium text-gray-900 dark:text-gray-50">Greyin Score = 85% platform composite + 15% experience = {greyinScoreRow.greyin_score}</p>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Shareable Verified Score badge (Phase D2) -- opt-in only, a
            fully public no-login page at /verify/[slug] showing only the
            same score breakdown already shown above, never raw evidence
            rows. Available regardless of Verified Expert status: even a
            partial, unverified score is real and shareable. */}
        {greyinScoreRow?.greyin_score != null && (
          <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Shareable Verified Score Badge
            </h2>
            <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
              Turn this on to get a public link to your Greyin Score breakdown — no login required to view it.
              Only the same numbers shown above; nothing else about your profile is exposed.
            </p>
            <form action="/api/profile/verified-badge" method="POST" className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={badgeRow?.enabled || false}
                  className="h-4 w-4 text-indigo-600 rounded dark:bg-gray-950"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable public badge</span>
              </label>
              {badgeRow?.enabled && badgeRow.slug && (
                <p className="text-sm">
                  <a
                    href={absoluteUrl(`/verify/${badgeRow.slug}`).toString()}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {absoluteUrl(`/verify/${badgeRow.slug}`).toString()}
                  </a>
                </p>
              )}
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700">
                Save
              </button>
            </form>
          </div>
        )}

        {/* Career Pivot -- only settable once you're already a Verified
            Expert, so this stays "senior, changing lanes" rather than a
            backdoor around the gate. */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Shuffle className="w-5 h-5" />
            Career Pivot
          </h2>
          {greyinScoreRow?.is_verified_expert ? (
            <>
              <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
                Pivoting? Tag yourself as a pivoter to unlock jobs explicitly open to career changers,
                a spot on StackWorks&apos;s People directory, and mentor-matching on Salt &amp; Pepper.
              </p>
              <form action="/api/profile/update-pivot" method="POST" className="space-y-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_pivoter"
                    defaultChecked={profile?.is_pivoter || false}
                    className="h-4 w-4 text-indigo-600 rounded dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">I&apos;m pivoting to a new domain</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">From</label>
                    <input
                      type="text"
                      name="pivot_from_domain"
                      defaultValue={profile?.pivot_from_domain || ''}
                      placeholder="e.g., Finance"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">To</label>
                    <input
                      type="text"
                      name="pivot_to_domain"
                      defaultValue={profile?.pivot_to_domain || ''}
                      placeholder="e.g., Software Engineering"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Note</label>
                  <textarea
                    name="pivot_note"
                    defaultValue={profile?.pivot_note || ''}
                    rows={2}
                    placeholder="Why the switch, what you bring with you..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Status</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        name="pivot_status"
                        value="seeking"
                        defaultChecked={(profile?.pivot_status || 'seeking') === 'seeking'}
                      />
                      Seeking — looking for the new domain
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        name="pivot_status"
                        value="completed"
                        defaultChecked={profile?.pivot_status === 'completed'}
                      />
                      Completed — I made the jump
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
                >
                  <Save className="w-4 h-4" />
                  Save Pivot Status
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Verified Expert status is required to tag yourself as a career pivoter — build it on StackWorks,
              FlexPro, or Salt &amp; Pepper, or add your years of experience above.
            </p>
          )}
        </div>

        {/* Career Re-entry -- deliberately additive, not exclusionary like
            Career Pivot above. A re-entry candidate is returning to the
            SAME field after a gap (caregiving, health, layoff, sabbatical),
            so there's no domain mismatch to route around -- this just adds
            context wherever the candidate already shows up (candidate
            search, employer applications review), it doesn't change who
            can apply where. */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Career Re-entry
          </h2>
          {greyinScoreRow?.is_verified_expert ? (
            <>
              <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
                Returning to work after a gap? Tag it so employers see the context up front instead of
                a blank spot in your timeline — you&apos;ll still show up in normal candidate search and
                job applications exactly as before.
              </p>
              <form action="/api/profile/update-reentry" method="POST" className="space-y-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_reentry"
                    defaultChecked={profile?.is_reentry || false}
                    className="h-4 w-4 text-indigo-600 rounded dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">I&apos;m returning to work after a gap</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Reason</label>
                  <select
                    name="reentry_reason"
                    defaultValue={profile?.reentry_reason || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="caregiving">Caregiving</option>
                    <option value="health">Health</option>
                    <option value="layoff">Layoff</option>
                    <option value="sabbatical">Sabbatical</option>
                    <option value="relocation">Relocation</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Note</label>
                  <textarea
                    name="reentry_note"
                    defaultValue={profile?.reentry_note || ''}
                    rows={2}
                    placeholder="Anything you'd like employers to know..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
                >
                  <Save className="w-4 h-4" />
                  Save Re-entry Status
                </button>
              </form>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Verified Expert status is required to tag a career re-entry — build it on StackWorks,
              FlexPro, or Salt &amp; Pepper, or add your years of experience above.
            </p>
          )}
        </div>

        {/* Mentor Availability -- deliberately separate from Career Pivot:
            a lifelong domain expert who never personally pivoted is often
            exactly the right person to mentor someone entering their
            field, so this isn't limited to completed pivoters. */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Mentor Availability
          </h2>
          {greyinScoreRow?.is_verified_expert ? (
            <>
              <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
                Willing to talk to someone pivoting into your domain — whether or not you pivoted
                yourself? List yourself on Salt &amp; Pepper&apos;s mentor directory.
              </p>
              <form action="/api/profile/update-mentor" method="POST" className="space-y-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_mentor"
                    defaultChecked={profile?.is_mentor || false}
                    className="h-4 w-4 text-indigo-600 rounded dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">List me as a mentor</span>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Domain</label>
                  <input
                    type="text"
                    name="mentor_domain"
                    defaultValue={profile?.mentor_domain || profile?.pivot_to_domain || ''}
                    placeholder="e.g., Software Engineering"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Note</label>
                  <textarea
                    name="mentor_note"
                    defaultValue={profile?.mentor_note || ''}
                    rows={2}
                    placeholder="What you can help with..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
                >
                  <Save className="w-4 h-4" />
                  Save Mentor Availability
                </button>
              </form>
              <p className="text-sm text-gray-500 mt-4 dark:text-gray-400">
                Want to offer bookable, paid or free 1:1 sessions? Set up session times on{' '}
                <a href="https://flexpro.greyin.net/mentor-sessions/manage" className="text-indigo-600 hover:underline dark:text-indigo-400">
                  FlexPro
                </a>.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Verified Expert status is required to list yourself as a mentor.
            </p>
          )}
        </div>

        <form action="/api/profile/update" method="POST" className="space-y-6">
          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  defaultValue={profile?.full_name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400"
                />
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={profile?.phone || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  defaultValue={profile?.location || ''}
                  placeholder="City, Country"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Company Information (if employer) */}
          {company && (
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Company Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    defaultValue={company.name || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Industry
                  </label>
                  <input
                    type="text"
                    name="industry"
                    defaultValue={company.industry || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Company Size
                  </label>
                  <select
                    name="company_size"
                    defaultValue={company.company_size || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="501+">501+ employees</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Description
                  </label>
                  <textarea
                    name="company_description"
                    defaultValue={company.description || ''}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Candidate Information (if candidate) */}
          {candidate && (
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Professional Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Current Role
                  </label>
                  <input
                    type="text"
                    name="current_role"
                    defaultValue={candidate.current_role || ''}
                    placeholder="e.g., Senior Software Engineer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <ResumeSkillsUploader defaultResumeUrl={candidate.resume_url || ''} defaultSkills={candidate.skills || []} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Experience (years)
                  </label>
                  <input
                    type="number"
                    name="experience_years"
                    defaultValue={candidate.experience_years || ''}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    defaultValue={candidate.bio || ''}
                    rows={4}
                    placeholder="Tell us about yourself..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>

        {candidate && (
          <div className="bg-white rounded-lg shadow p-6 mt-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-2">Employment history</h2>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
              Private — only used to power anonymized salary trend graphs, never shown to
              other users.
            </p>
            <EmploymentHistoryEditor entries={employmentHistory || []} />
          </div>
        )}

        {pendingRecommendations && pendingRecommendations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mt-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-4">Recommendations to review</h2>
            <div className="divide-y">
              {pendingRecommendations.map((rec: any) => (
                <div key={rec.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-sm text-gray-700 whitespace-pre-line mb-1 dark:text-gray-300">&ldquo;{rec.body}&rdquo;</p>
                  <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">&mdash; {rec.profiles?.full_name || 'A Greyin member'}</p>
                  <div className="flex gap-3">
                    <form action={`/api/recommendations/${rec.id}/approve`} method="POST">
                      <button type="submit" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                        Approve &amp; show on my profile
                      </button>
                    </form>
                    <form action={`/api/recommendations/${rec.id}/dismiss`} method="POST">
                      <button type="submit" className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                        Dismiss
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!pendingReferenceRequestCount && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6 flex items-center justify-between dark:bg-amber-950/40 dark:border-amber-900">
            <p className="text-sm text-amber-800 dark:text-amber-400">
              You have {pendingReferenceRequestCount} reference request{pendingReferenceRequestCount === 1 ? '' : 's'} waiting on you to answer.
            </p>
            <Link href="/references/respond" className="text-sm font-semibold text-amber-800 hover:underline dark:text-amber-400">
              Respond &rarr;
            </Link>
          </div>
        )}

        {myReferences && myReferences.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mt-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-1">Your references</h2>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
              Employers you&rsquo;ve applied to can request a private check from these people — their answer goes straight
              back to the employer, never through you.
            </p>
            <div className="divide-y">
              {myReferences.map((ref: any) => (
                <div key={ref.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-50">{ref.profiles?.full_name || 'A reference'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {RELATIONSHIP_LABEL[ref.relationship_type] || ref.relationship_type} — {ref.relationship_detail}
                    </p>
                    {ref.verified_pillar && (
                      <p className="text-xs text-green-700 mt-0.5 dark:text-green-400">
                        Greyin-verified: worked together via {PILLAR_LABEL[ref.verified_pillar] || ref.verified_pillar}
                      </p>
                    )}
                  </div>
                  <form action={`/api/references/${ref.id}/delete`} method="POST">
                    <button type="submit" className="text-xs font-medium text-gray-400 hover:text-red-600 dark:text-gray-500">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        {mySkills && mySkills.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mt-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-4">Your skills</h2>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
              Endorsements and ratings come from peers and real collaborations across the
              ecosystem &mdash; see them on your{' '}
              <Link href={`/candidates/${user.id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">public profile</Link>.
              Feature a skill to pin it to the top there.
            </p>
            <div className="divide-y">
              {mySkills.map((s) => (
                <div key={s.skill} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-50">{s.skill}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {s.endorsement_count} endorsement{s.endorsement_count === 1 ? '' : 's'}
                      {s.rating_count > 0 ? ` · ${s.avg_rating} avg rating (${s.rating_count})` : ''}
                    </p>
                  </div>
                  <form action="/api/profile/skills/feature" method="POST">
                    <input type="hidden" name="skill" value={s.skill} />
                    <input type="hidden" name="featured" value={(!s.featured).toString()} />
                    <button
                      type="submit"
                      className={
                        s.featured
                          ? 'text-xs font-medium text-indigo-600 dark:text-indigo-400'
                          : 'text-xs font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400'
                      }
                    >
                      {s.featured ? 'Featured – remove' : 'Feature this skill'}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
