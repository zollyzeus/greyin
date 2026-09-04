import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { ArrowLeft, BadgeCheck, Users } from 'lucide-react'

/**
 * Moved here from deepedge 2026-08-24 -- the eligibility gate this
 * page manages affects Verified Expert status across all four
 * marketplace apps (deepedge, FlexPro, Salt & Pepper, StackWorks),
 * not just DeepEdge; Greyin Hub has no pillar affiliation of its own,
 * making it the natural single home for genuinely platform-wide admin
 * (see admin/llm, moved the same day for the same reason). Member
 * voting itself still happens on deepedge's own /governance/threshold
 * -- only the admin-facing summary + live gate-settings editor moved.
 */
export default async function AdminThresholdVotesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/threshold-votes')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const [{ data: settings }, { data: summary, error: summaryError }] = await Promise.all([
    supabase.from('platform_gate_settings').select('*').eq('id', 1).single(),
    supabase.rpc('get_threshold_vote_summary'),
  ])

  const verifiedBucket = summary?.find((row: any) => row.bucket_verified_expert === true)
  const otherBucket = summary?.find((row: any) => row.bucket_verified_expert === false)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Eligibility Threshold Governance</h1>

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Gate settings updated.
          </div>
        )}
        {(error || summaryError) && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {error ? decodeURIComponent(error) : summaryError?.message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 dark:text-gray-50">Member vote results (advisory)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
              <p className="flex items-center gap-1 text-sm font-semibold text-indigo-700 mb-2 dark:text-indigo-400">
                <BadgeCheck className="h-4 w-4" /> Verified Experts
              </p>
              {verifiedBucket ? (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{verifiedBucket.vote_count} votes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Avg proposed years: {verifiedBucket.avg_proposed_years} (median {verifiedBucket.median_proposed_years})</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Avg proposed score: {verifiedBucket.avg_proposed_score} (median {verifiedBucket.median_proposed_score})</p>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No votes yet.</p>
              )}
            </div>
            <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="flex items-center gap-1 text-sm font-semibold text-gray-700 mb-2 dark:text-gray-300">
                <Users className="h-4 w-4" /> Everyone else
              </p>
              {otherBucket ? (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{otherBucket.vote_count} votes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Avg proposed years: {otherBucket.avg_proposed_years} (median {otherBucket.median_proposed_years})</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">Avg proposed score: {otherBucket.avg_proposed_score} (median {otherBucket.median_proposed_score})</p>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No votes yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 dark:text-gray-50">Live gate settings</h2>
          <p className="text-sm text-gray-600 mb-4 dark:text-gray-400">
            This is what actually takes effect across Greyin B2B, FlexPro, Salt &amp; Pepper, and StackWorks the
            moment you save it — nothing above applies automatically.
          </p>
          <form action="/api/admin/gate-settings/update" method="POST" className="flex flex-col sm:flex-row gap-4 items-end">
            <div>
              <label htmlFor="min_years_experience" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Min years experience</label>
              <input
                id="min_years_experience" name="min_years_experience" type="number" min={0} required
                defaultValue={settings?.min_years_experience ?? 12}
                className="mt-1 block w-32 px-3 py-2 border border-gray-300 rounded-lg shadow-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="min_greyin_score" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Min Greyin Score</label>
              <input
                id="min_greyin_score" name="min_greyin_score" type="number" min={0} max={100} required
                defaultValue={settings?.min_greyin_score ?? 75}
                className="mt-1 block w-32 px-3 py-2 border border-gray-300 rounded-lg shadow-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-semibold">
              Save
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
