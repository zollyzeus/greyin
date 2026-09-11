import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, ShieldAlert } from 'lucide-react'

/**
 * AI enhancement (Phase D1, "11 new AI enhancements" plan) --
 * cross-pillar collusion/fraud detection. Extends peer_rater_reliability/
 * peer_project_reciprocity_flags (090/091, StackWorks-only) across
 * FlexPro + Salt & Pepper + StackWorks simultaneously: a pair trading
 * favorable signals on TWO DIFFERENT pillars is invisible to any
 * single-pillar check by construction. Deterministic SQL
 * (cross_pillar_reciprocity_flags, 132), no LLM -- flags a pair for
 * human review, never auto-restricts either account, same posture as
 * every other trust/safety surface this session. Admin-only (not
 * employer, unlike 090/091): this implicates both people in a pair
 * equally and isn't a hiring-diligence signal about one candidate.
 */
export default async function CrossPillarFlagsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/cross-pillar-flags')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: flags, error } = await supabase
    .from('cross_pillar_reciprocity_flags')
    .select('person_a, person_a_name, person_b, person_b_name, cross_pillar_combos, mutual_favor_pair_count')
    .order('mutual_favor_pair_count', { ascending: false })

  return (
    <>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link href="/admin" className="flex items-center text-gray-600 hover:text-indigo-600 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Cross-Pillar Reciprocity Flags</h1>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Pairs of accounts trading favorable signals across two <em>different</em> platforms — e.g. a high FlexPro
          review in one direction and a Salt &amp; Pepper project upvote in the other. A flag is for human review
          only; it never restricts either account automatically.
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
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Person A</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Person B</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Pillar combo(s)</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Mutual favor pairs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(flags || []).map((row: any) => (
                <tr key={`${row.person_a}-${row.person_b}`}>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-50">{row.person_a_name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-50">{row.person_b_name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{(row.cross_pillar_combos || []).join(', ')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700 dark:text-amber-400">{row.mutual_favor_pair_count}</td>
                </tr>
              ))}
              {(!flags || flags.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No cross-pillar reciprocity patterns found.
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
