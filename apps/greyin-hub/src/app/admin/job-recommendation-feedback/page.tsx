import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, MessageSquareWarning } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = {
  profile: 'Based on your profile',
  history: 'Based on applied jobs',
  preferences: 'Matches your preferences',
  top_candidate: "Where you'd be a top candidate",
}

/**
 * Recommendation-feedback loop, Phase 3 (125,
 * get_job_recommendation_feedback_report()). Aggregate-only, same
 * discipline as /admin/bias-audit -- never a row traceable to one
 * person's opinion about one job, only per-section helpful rates. The
 * point of this page isn't to act on the numbers yet (see this
 * feature's own memory/decision trail: seeded/test-account feedback
 * proves the pipeline works end to end, but isn't real calibration
 * signal) -- it's the same pipe real user feedback will flow through
 * once there's enough of it to mean something.
 */
export default async function JobRecommendationFeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/job-recommendation-feedback')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: report, error } = await supabase.rpc('get_job_recommendation_feedback_report')

  return (
    <>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Job Recommendation Feedback</h1>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Aggregate helpful/not-helpful rates per recommendation type on DeepEdge&rsquo;s /jobs page — never an
          individual candidate&rsquo;s opinion about a specific job, only counts.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {error.message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Recommendation type</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Helpful</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Not relevant</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Already applied</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Wrong fit</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Helpful rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(report || []).map((row: any) => (
                <tr key={row.recommendation_type}>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-50">{TYPE_LABEL[row.recommendation_type] || row.recommendation_type}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.helpful_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.not_relevant_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.already_applied_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.wrong_fit_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.total_count}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-50">{(row.helpful_rate * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {(!report || report.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No feedback recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
