import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { Vote, BadgeCheck } from 'lucide-react'

export default async function ThresholdGovernancePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const { success, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/governance/threshold')
  }

  const [{ data: settings }, { data: myVote }, { data: myScore }] = await Promise.all([
    supabase.from('platform_gate_settings').select('*').eq('id', 1).single(),
    supabase.from('threshold_votes').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('greyin_scores').select('is_verified_expert, greyin_score').eq('user_id', user.id).maybeSingle(),
  ])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-2 mb-2">
          <Vote className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Have a say in the eligibility bar</h1>
        </div>
        <p className="text-gray-600 mb-2 dark:text-gray-400">
          This vote is advisory: an admin reviews the results and decides whether to change anything. Nothing
          here updates the live threshold automatically.
        </p>
        {myScore && (
          <p className="flex items-center gap-1 text-sm font-semibold mb-8 text-indigo-700 dark:text-indigo-400">
            <BadgeCheck className="h-4 w-4" />
            {myScore.is_verified_expert ? 'You are currently a Verified Expert' : 'You are not currently a Verified Expert'}
            {myScore.greyin_score != null ? ` · Greyin Score ${myScore.greyin_score}` : ''}
          </p>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-8 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">Current live threshold</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {settings?.min_years_experience ?? 12}+ years of experience, or a Greyin Score of {settings?.min_greyin_score ?? 75}+.
          </p>
        </div>

        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Your vote has been recorded.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 mb-4 dark:text-gray-50">
            {myVote ? 'Update your vote' : 'Cast your vote'}
          </h2>
          <form action="/api/governance/threshold-vote" method="POST" className="space-y-5">
            <div>
              <label htmlFor="proposed_years" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Where should the years-of-experience bar sit?
              </label>
              <input
                id="proposed_years"
                name="proposed_years"
                type="number"
                min={0}
                required
                defaultValue={myVote?.proposed_years ?? 12}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="proposed_score" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Where should the Greyin Score bar sit (0-100)?
              </label>
              <input
                id="proposed_score"
                name="proposed_score"
                type="number"
                min={0}
                max={100}
                required
                defaultValue={myVote?.proposed_score ?? 75}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <div>
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comment (optional)</label>
              <textarea
                id="comment"
                name="comment"
                rows={3}
                defaultValue={myVote?.comment || ''}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
              {myVote ? 'Update Vote' : 'Submit Vote'}
            </button>
          </form>
        </div>

        <p className="text-sm text-gray-500 mt-6 dark:text-gray-400">
          <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">Back to dashboard</Link>
        </p>
      </div>
    </main>
  )
}
