import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Phone, MapPin, Users, Save, BadgeCheck } from 'lucide-react'
import Link from 'next/link'
import { EcosystemWidget } from '@/components/EcosystemWidget'

const OUTCOME_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

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

  // FlexPro's seller_rating/total_reviews already ride along on
  // profile.* (shared profiles table); Salt & Pepper's reputation needs
  // its own cross-app read. StackWorks's own verified_outcomes get their
  // full detailed section below, so this is just the other two pillars.
  const { data: reputationRow } = await supabase
    .from('reputation_scores')
    .select('score')
    .eq('user_id', user.id)
    .maybeSingle()

  // Unified, Bayesian-shrunk, headcount-weighted composite of the
  // reputation/rating fields above plus StackWorks's own verified_outcomes
  // and career experience (036).
  const { data: greyinScoreRow } = await supabase
    .from('greyin_scores')
    .select('greyin_score, stackworks_score, stackworks_evidence, flexpro_score, flexpro_evidence, saltnpepper_score, saltnpepper_evidence, greymatters_score, greymatters_evidence, platform_composite, years_experience')
    .eq('user_id', user.id)
    .maybeSingle()

  await supabase.rpc('finalize_expired_verified_outcomes')

  const { data: outcomes } = await supabase
    .from('verified_outcomes')
    .select(
      'id, status, score, ai_score, ai_notes, human_score, human_notes, created_at, project_applications:application_id ( project_asks:ask_id ( role_title ) )'
    )
    .eq('subject_user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700">
              ← Back to Dashboard
            </Link>
            <h1 className="text-xl font-semibold">Community Profile</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />

        {((profile?.total_reviews ?? 0) > 0 || (reputationRow?.score ?? 0) > 0) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BadgeCheck className="w-5 h-5" />
              Also active elsewhere
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {(profile?.total_reviews ?? 0) > 0 && (
                <div>
                  <p className="text-gray-500">FlexPro</p>
                  <p className="font-semibold text-gray-900">★ {profile.seller_rating?.toFixed(1)} ({profile.total_reviews} reviews)</p>
                </div>
              )}
              {(reputationRow?.score ?? 0) > 0 && (
                <div>
                  <p className="text-gray-500">Salt &amp; Pepper</p>
                  <p className="font-semibold text-gray-900">{reputationRow!.score} reputation</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BadgeCheck className="w-5 h-5" />
              Verified Outcomes
            </h2>
            {greyinScoreRow?.greyin_score != null && (
              <span className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm font-bold" title="Career experience + verified track record across all Greyin platforms">
                Greyin Score: {greyinScoreRow.greyin_score}
              </span>
            )}
          </div>

          {greyinScoreRow?.greyin_score != null && (
            <details className="mb-4 pb-4 border-b border-gray-100">
              <summary className="text-xs font-medium text-teal-600 cursor-pointer select-none">How is this calculated?</summary>
              <div className="mt-3 space-y-1.5 text-xs text-gray-600">
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
                <p className="font-medium text-gray-900">Greyin Score = 85% platform composite + 15% experience = {greyinScoreRow.greyin_score}</p>
              </div>
            </details>
          )}

          {outcomes && outcomes.length > 0 ? (
            <div className="divide-y">
              {outcomes.map((o: any) => (
                <div key={o.id} className="py-3">
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <span className="font-medium">{o.project_applications?.project_asks?.role_title || 'Submission'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${OUTCOME_STATUS_STYLES[o.status]}`}>
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                      {o.score !== null ? ` · ${o.score}/100` : ''}
                    </span>
                  </div>
                  {o.ai_score !== null && (
                    <p className="text-xs text-gray-500">AI: {o.ai_score}/100{o.ai_notes ? ` — ${o.ai_notes}` : ''}</p>
                  )}
                  {o.human_score !== null && (
                    <p className="text-xs text-gray-500">Reviewer: {o.human_score}/100{o.human_notes ? ` — ${o.human_notes}` : ''}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Nothing submitted for verification yet. Apply to an ask on{' '}
              <Link href="/projects" className="text-indigo-600 hover:text-indigo-700">Projects</Link> to start building your track record.
            </p>
          )}
        </div>

        <form action="/api/profile/update" method="POST" className="space-y-6">
          {/* Profile Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Basic Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  defaultValue={profile?.full_name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">This will be shown on your posts and comments</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  name="bio"
                  defaultValue={profile?.bio || ''}
                  rows={4}
                  placeholder="Tell the community about yourself..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  defaultValue={profile?.location || ''}
                  placeholder="City, Country"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interests
                </label>
                <input
                  type="text"
                  name="interests"
                  defaultValue={profile?.interests?.join(', ') || ''}
                  placeholder="e.g., Technology, Design, Business"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separate interests with commas</p>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Social Links</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  defaultValue={profile?.website || ''}
                  placeholder="https://yourwebsite.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LinkedIn
                </label>
                <input
                  type="url"
                  name="linkedin"
                  defaultValue={profile?.linkedin || ''}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Twitter Handle
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-600">
                    @
                  </span>
                  <input
                    type="text"
                    name="twitter"
                    defaultValue={profile?.twitter || ''}
                    placeholder="username"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="email_notifications"
                    defaultChecked={profile?.email_notifications}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Email me when someone replies to my posts
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="comment_notifications"
                    defaultChecked={profile?.comment_notifications}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Email me when someone comments on my discussions
                  </span>
                </label>
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
