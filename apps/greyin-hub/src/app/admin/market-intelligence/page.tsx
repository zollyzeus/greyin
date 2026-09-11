import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, TrendingUp } from 'lucide-react'

/**
 * AI enhancement (Phase C3, "11 new AI enhancements" plan) -- admin-only
 * aggregate market-intelligence report. Unlike C1/C2 (live/on-demand),
 * this reads the latest pre-generated row (get_latest_market_intelligence_report(),
 * 130/131) rather than recomputing per view -- the underlying stats
 * aggregate over the whole platform, expensive enough to warrant the
 * same "generated on a schedule, read cheaply" split as greyin_scores'
 * own scalability fix (122). A "Generate now" button exists so an admin
 * isn't stuck waiting on the 24h timer for the first report.
 */
export default async function MarketIntelligencePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/market-intelligence')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: rows, error } = await supabase.rpc('get_latest_market_intelligence_report')
  const report = rows?.[0] ?? null

  return (
    <>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Market Intelligence</h1>
          </div>
          <form action="/api/admin/market-intelligence/generate" method="POST">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
            >
              Generate now
            </button>
          </form>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          An AI-synthesized briefing over real, platform-wide aggregate stats — skill demand, hiring velocity, and
          salary trends — regenerated every 24 hours. Admin-only; never traceable to one company or candidate.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {error.message}
          </div>
        )}

        {report ? (
          <>
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">
                Generated {new Date(report.generated_at).toLocaleString()}
              </p>
              <p className="text-sm text-gray-800 whitespace-pre-line dark:text-gray-200">{report.report_text}</p>
            </div>

            <details className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
              <summary className="text-sm font-semibold text-gray-700 cursor-pointer dark:text-gray-300">Raw stats</summary>
              <pre className="mt-3 text-xs text-gray-600 overflow-x-auto dark:text-gray-400">{JSON.stringify(report.raw_stats, null, 2)}</pre>
            </details>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            No report generated yet.
          </div>
        )}
      </div>
    </>
  )
}
