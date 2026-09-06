import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { ArrowLeft, Scale, AlertTriangle } from 'lucide-react'

const BUCKET_LABEL: Record<string, string> = {
  woman: 'Woman',
  man: 'Man',
  non_binary: 'Non-binary',
  self_describe: 'Self-described',
  prefer_not_to_say: 'Prefer not to say',
  not_disclosed: 'Not disclosed',
}

/**
 * AI moat roadmap item: bias/fairness auditing on AI matching output
 * (119, get_bias_audit_report()). Scoped per explicit user decision
 * 2026-09-05 -- real disparate-impact measurement needs demographic
 * data, which is entirely optional/self-disclosed (profile_demographics)
 * and was never collected before. Only ever shows aggregate counts per
 * bucket, standard EEOC "four-fifths rule" style: a bucket selected at
 * under 80% of the best-performing bucket's rate is flagged. Never shows
 * -- and the underlying function can never return -- a single person's
 * row.
 */
export default async function BiasAuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/bias-audit')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: report, error } = await supabase.rpc('get_bias_audit_report', { p_feature_key: 'longlist_candidate_matching' })

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">AI Matching Bias Audit</h1>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Compares each self-disclosed gender bucket&rsquo;s share of Longlist&rsquo;s AI-surfaced candidate matches
          against its share of the eligible pool (people with stated future interests). Self-ID is entirely optional
          on the member side, never shown to employers, and never used as a matching input — only aggregate counts
          are ever shown here, never an individual&rsquo;s data.
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
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Bucket</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Eligible</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Surfaced</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Selection rate</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">4/5ths ratio</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(report || []).map((row: any) => (
                <tr key={row.bucket}>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-50">{BUCKET_LABEL[row.bucket] || row.bucket}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.eligible_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.surfaced_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{(row.selection_rate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.four_fifths_ratio != null ? row.four_fifths_ratio.toFixed(2) : '—'}</td>
                  <td className="px-4 py-3">
                    {row.flagged && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> Below 4/5ths threshold
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(!report || report.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No eligible pool data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
