import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Phone, MapPin, Package, Save, Star, BadgeCheck } from 'lucide-react'
import Link from 'next/link'
import { EcosystemWidget } from '@/components/EcosystemWidget'

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
    .select('greyin_score, stackworks_score, stackworks_evidence, flexpro_score, flexpro_evidence, saltnpepper_score, saltnpepper_evidence, greymatters_score, greymatters_evidence, platform_composite, years_experience')
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700">
              ← Back to Dashboard
            </Link>
            <h1 className="text-xl font-semibold">Seller Profile</h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <EcosystemWidget activePillars={(memberships || []).map((m) => m.pillar)} />

        {(verifiedCount > 0 || (profile?.total_reviews ?? 0) > 0 || (reputationRow?.score ?? 0) > 0 || deliveryQualityCount > 0) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
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
                  <p className="text-gray-500">StackWorks</p>
                  <p className="font-semibold text-gray-900">{verifiedCount} verified outcome{verifiedCount === 1 ? '' : 's'} · avg {verifiedAvg}/100</p>
                </div>
              )}
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

            {deliveryQualityCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-sm">
                <p className="text-gray-500">AI delivery quality (this platform, informational only)</p>
                <p className="font-semibold text-gray-900">{deliveryQualityCount} scored deliver{deliveryQualityCount === 1 ? 'y' : 'ies'} · avg {deliveryQualityAvg}/100</p>
              </div>
            )}

            {greyinScoreRow?.greyin_score != null && (
              <details className="mt-4 pt-4 border-t border-gray-100">
                <summary className="text-xs font-medium text-indigo-600 cursor-pointer select-none">How is this calculated?</summary>
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
          </div>
        )}

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
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={profile?.phone || ''}
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
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Professional Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Professional Title
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue={profile?.title || ''}
                  placeholder="e.g., Graphic Designer, Web Developer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  About Me
                </label>
                <textarea
                  name="bio"
                  defaultValue={profile?.bio || ''}
                  rows={4}
                  placeholder="Describe your expertise and services..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Skills
                </label>
                <input
                  type="text"
                  name="skills"
                  defaultValue={profile?.skills?.join(', ') || ''}
                  placeholder="e.g., Logo Design, Branding, UI/UX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separate skills with commas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Languages
                </label>
                <input
                  type="text"
                  name="languages"
                  defaultValue={profile?.languages?.join(', ') || ''}
                  placeholder="e.g., English, Hindi, Spanish"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separate languages with commas</p>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razorpay Account ID
                </label>
                <input
                  type="text"
                  name="razorpay_account_id"
                  defaultValue={profile?.razorpay_account_id || ''}
                  placeholder="acc_xxxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required to receive payments for your gigs
                </p>
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
