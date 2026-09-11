import { notFound } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * AI enhancement (Phase D2, "11 new AI enhancements" plan) -- the
 * platform's first genuinely public, no-login page showing real
 * profile-derived data. Deliberately opt-in only (public_score_badges,
 * 133): a stranger visiting an unknown or never-enabled slug gets a
 * plain 404, indistinguishable from a slug that was enabled and then
 * turned back off -- get_public_score_badge() itself returns nothing at
 * all for either case, so this page can't leak which one it was.
 * Renders ONLY the same score breakdown already shown on the badge
 * owner's own /profile page -- never raw evidence rows (no review text,
 * no project titles, no reputation event detail).
 */
export default async function VerifyBadgePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: rows } = await supabase.rpc('get_public_score_badge', { p_slug: slug })
  const badge = rows?.[0]

  if (!badge) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-lg shadow p-8 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Greyin Verified Score</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{badge.full_name}</h1>
            </div>
            <span className="px-4 py-2 bg-gray-900 text-white rounded-lg text-lg font-bold">
              {Math.round(badge.greyin_score)}
            </span>
          </div>

          {badge.is_verified_expert && (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mb-6 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900">
              <BadgeCheck className="h-4 w-4" />
              Verified Expert
            </p>
          )}

          <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
            <p>Each platform&apos;s raw average is shrunk toward the platform-wide mean based on how much evidence exists there, so one lucky 100 doesn&apos;t outrank someone with ten solid 80s:</p>
            <ul className="pl-4 list-disc space-y-1">
              {badge.stackworks_score != null && (
                <li>StackWorks: {badge.stackworks_score}/100 (from {badge.stackworks_evidence} verified outcome{badge.stackworks_evidence === 1 ? '' : 's'})</li>
              )}
              {badge.flexpro_score != null && (
                <li>FlexPro: {badge.flexpro_score}/100 (from {badge.flexpro_evidence} review{badge.flexpro_evidence === 1 ? '' : 's'})</li>
              )}
              {badge.saltnpepper_score != null && (
                <li>Salt &amp; Pepper: {badge.saltnpepper_score}/100 (from {badge.saltnpepper_evidence} reputation event{badge.saltnpepper_evidence === 1 ? '' : 's'})</li>
              )}
              {badge.greymatters_score != null && (
                <li>GreyMatters: {badge.greymatters_score}/100 (from {badge.greymatters_evidence} scored post{badge.greymatters_evidence === 1 ? '' : 's'})</li>
              )}
            </ul>
            <p>Platform composite (headcount-weighted across whichever of the above exist): {Math.round(badge.platform_composite)}/100</p>
            <p>Career experience: {Math.min(badge.years_experience ?? 0, 20)} of 20 capped years counted</p>
            <p className="font-medium text-gray-900 dark:text-gray-50">Greyin Score = 85% platform composite + 15% experience = {Math.round(badge.greyin_score)}</p>
          </div>

          <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
            This is a shareable, public summary the account holder opted into publishing. It contains only the score
            breakdown above — no messages, reviews, or other private profile detail.
          </p>
        </div>
      </div>
    </main>
  )
}
