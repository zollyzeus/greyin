import { createClient } from '@/app/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Phone, MapPin, Save, BadgeCheck } from 'lucide-react'
import Link from 'next/link'
import { EcosystemWidget } from '@/app/components/EcosystemWidget'
import { ThemeToggle } from '@/components/ThemeToggle'

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

  // Cross-app trust signals -- profiles already carries FlexPro's
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
  // Own AI-rated post scores (048_ai_quality_scores.sql) -- unlike the
  // other three signals above, this one is native to this app rather
  // than a cross-app read, and it's the platform input greyin_score was
  // missing until now (see greymattersScore below).
  const { data: postQualityScores } = await supabase
    .from('ai_quality_scores')
    .select('score')
    .eq('subject_user_id', user.id)
    .eq('content_type', 'greymatters_post')
  // Unified, Bayesian-shrunk, headcount-weighted composite of all four
  // platform signals above plus career experience (036/048) -- the
  // single number, the four fields above are its breakdown.
  const { data: greyinScoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, stackworks_score, stackworks_evidence, flexpro_score, flexpro_evidence, saltnpepper_score, saltnpepper_evidence, greymatters_score, greymatters_evidence, platform_composite, years_experience')
    .eq('user_id', user.id)
    .maybeSingle()
  const verifiedCount = verifiedOutcomes?.length || 0
  const verifiedAvg = verifiedCount > 0
    ? Math.round(verifiedOutcomes!.reduce((s, o) => s + (o.score || 0), 0) / verifiedCount)
    : null
  const postQualityCount = postQualityScores?.length || 0
  const postQualityAvg = postQualityCount > 0
    ? Math.round(postQualityScores!.reduce((s, o) => s + (o.score || 0), 0) / postQualityCount)
    : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
              ← Back to Dashboard
            </Link>
            <h1 className="text-xl font-semibold">Author Profile</h1>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />

        {(verifiedCount > 0 || (profile?.total_reviews ?? 0) > 0 || (reputationRow?.score ?? 0) > 0 || postQualityCount > 0) && (
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
              {postQualityCount > 0 && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">GreyMatters</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-50">{postQualityCount} scored post{postQualityCount === 1 ? '' : 's'} · avg {postQualityAvg}/100</p>
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
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">This will be shown on your posts</p>
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
                  Bio
                </label>
                <textarea
                  name="bio"
                  defaultValue={profile?.bio || ''}
                  rows={4}
                  placeholder="Tell your readers about yourself..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  defaultValue={profile?.website || ''}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                  Twitter Handle
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                    @
                  </span>
                  <input
                    type="text"
                    name="twitter"
                    defaultValue={profile?.twitter_handle || ''}
                    placeholder="username"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>
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
    </div>
  )
}
