import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Package, Save, BadgeCheck } from 'lucide-react'
import { EcosystemWidget } from '@/components/EcosystemWidget'
import { WorkspaceShell } from '@/components/WorkspaceShell'

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

  // 'skills' isn't its own profiles column -- it's the same platform-wide
  // profile_skills table skill_endorsements/skill_ratings already read
  // (114, integrity audit follow-up).
  const { data: skillRows } = await supabase
    .from('profile_skills')
    .select('skill')
    .eq('user_id', user.id)
  const skills = (skillRows || []).map((r) => r.skill)

  // Cross-app trust signals -- profiles already carries this app's own
  // seller_rating/total_reviews (via profile.*); the other two need
  // their own cross-app reads, same pattern stackworks already uses against
  // saltnpepper's builder_projects. Best-effort: someone with no
  // activity on a given pillar just shows nothing for it.
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
  // Own AI-rated delivery scores (048_ai_quality_scores.sql) -- additive/
  // informational only, does not feed greyin_score (unlike GreyMatters'
  // post score, which does -- see greymatters_score below).
  const { data: deliveryQualityScores } = await supabase
    .from('ai_quality_scores')
    .select('score')
    .eq('subject_user_id', user.id)
    .eq('content_type', 'flexpro_delivery')
  // Unified, Bayesian-shrunk, headcount-weighted composite of all four
  // platform signals above plus career experience (036/048) -- the
  // single number, the four fields above are its breakdown.
  const { data: greyinScoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, is_verified_expert, stackworks_score, stackworks_evidence, flexpro_score, flexpro_evidence, saltnpepper_score, saltnpepper_evidence, greymatters_score, greymatters_evidence, platform_composite, years_experience')
    .eq('user_id', user.id)
    .maybeSingle()
  const verifiedCount = verifiedOutcomes?.length || 0
  const verifiedAvg = verifiedCount > 0
    ? Math.round(verifiedOutcomes!.reduce((s, o) => s + (o.score || 0), 0) / verifiedCount)
    : null
  const deliveryQualityCount = deliveryQualityScores?.length || 0
  const deliveryQualityAvg = deliveryQualityCount > 0
    ? Math.round(deliveryQualityScores!.reduce((s, o) => s + (o.score || 0), 0) / deliveryQualityCount)
    : null

  return (
    <WorkspaceShell
      activeSection="profile"
      role={profile?.role}
      userName={profile?.full_name || 'User'}
      verified={!!greyinScoreRow?.is_verified_expert}
      greyinScore={greyinScoreRow?.greyin_score ?? null}
      pageTitle="Profile"
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />

        {(verifiedCount > 0 || (profile?.total_reviews ?? 0) > 0 || (reputationRow?.score ?? 0) > 0 || deliveryQualityCount > 0) && (
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

            {deliveryQualityCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-sm dark:border-gray-800">
                <p className="text-gray-500 dark:text-gray-400">AI delivery quality (this platform, informational only)</p>
                <p className="font-semibold text-gray-900 dark:text-gray-50">{deliveryQualityCount} scored deliver{deliveryQualityCount === 1 ? 'y' : 'ies'} · avg {deliveryQualityAvg}/100</p>
              </div>
            )}

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
                  Display Name
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

          {/* Professional Information */}
          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Professional Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Professional Title
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue={profile?.title || ''}
                  placeholder="e.g., Graphic Designer, Web Developer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  About Me
                </label>
                <textarea
                  name="bio"
                  defaultValue={profile?.bio || ''}
                  rows={4}
                  placeholder="Describe your expertise and services..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Skills
                </label>
                <input
                  type="text"
                  name="skills"
                  defaultValue={skills.join(', ')}
                  placeholder="e.g., Logo Design, Branding, UI/UX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Separate skills with commas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Languages
                </label>
                <input
                  type="text"
                  name="languages"
                  defaultValue={profile?.languages?.join(', ') || ''}
                  placeholder="e.g., English, Hindi, Spanish"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Separate languages with commas</p>
              </div>
            </div>
          </div>

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
      </div>
    </WorkspaceShell>
  )
}
