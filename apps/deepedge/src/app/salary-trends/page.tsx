import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, ArrowLeft, TrendingUp } from 'lucide-react'
import { SalaryTrendChart } from '@/components/SalaryTrendChart'
import { ThemeToggle } from '@/components/ThemeToggle'

const EXPERIENCE_BUCKETS = ['0-2', '3-6', '7-14', '15+']
const LEVELS = ['junior', 'mid', 'senior', 'lead', 'director', 'executive']

export default async function SalaryTrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; level?: string; experience_bucket?: string; location?: string; watched?: string }>
}) {
  const { role, level, experience_bucket: experienceBucket, location, watched } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/salary-trends')
  }

  const { data: myWatches } = await supabase
    .from('salary_trend_watches')
    .select('role_title, level, location')
    .eq('user_id', user.id)
  const isWatching = !!role && (myWatches || []).some(
    (w) => w.role_title === role.toLowerCase().trim() && w.level === (level || null) && w.location === ((location || '').toLowerCase().trim() || null)
  )

  let query = supabase.from('salary_trends').select('*')
  if (role) query = query.eq('role_title', role.toLowerCase().trim())
  if (level) query = query.eq('level', level)
  if (experienceBucket) query = query.eq('experience_bucket', experienceBucket)
  if (location) query = query.eq('location', location.toLowerCase().trim())

  const { data: rows } = role ? await query.order('period', { ascending: true }) : { data: [] }

  // One bar per source (past/expected/market), averaged across whatever
  // periods matched the filter -- a real quarter-over-quarter view is a
  // natural v2 once there's enough data for it to be readable.
  const bySource = new Map<string, { total_low: number; total_high: number; total_n: number; weight: number }>()
  for (const r of rows || []) {
    const existing = bySource.get(r.source) || { total_low: 0, total_high: 0, total_n: 0, weight: 0 }
    existing.total_low += r.avg_salary_low * r.sample_size
    existing.total_high += r.avg_salary_high * r.sample_size
    existing.total_n += r.sample_size
    existing.weight += r.sample_size
    bySource.set(r.source, existing)
  }
  const chartRows = Array.from(bySource.entries()).map(([source, v]) => ({
    source,
    avg_salary_low: v.weight ? v.total_low / v.weight : 0,
    avg_salary_high: v.weight ? v.total_high / v.weight : 0,
    sample_size: v.total_n,
  }))

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Building2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Salary Trends</h1>
        </div>
        <p className="text-gray-600 mb-6 text-sm dark:text-gray-400">
          Sourced from Verified Experts' own employment history, expected salary, and open job
          postings — never a single person's number, always an average across at least 3 people
          or postings.
        </p>

        <form className="bg-white rounded-lg shadow-md p-6 mb-8 grid grid-cols-1 sm:grid-cols-4 gap-3 dark:bg-gray-900">
          <input
            type="text"
            name="role"
            defaultValue={role || ''}
            placeholder="Role (e.g. Staff Engineer)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <select name="level" defaultValue={level || ''} className="border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <option value="">Any level</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
            ))}
          </select>
          <select name="experience_bucket" defaultValue={experienceBucket || ''} className="border border-gray-300 rounded-lg px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
            <option value="">Any experience</option>
            {EXPERIENCE_BUCKETS.map((b) => (
              <option key={b} value={b}>{b} years</option>
            ))}
          </select>
          <input
            type="text"
            name="location"
            defaultValue={location || ''}
            placeholder="Location"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-3 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-sm">
            Show trends
          </button>
        </form>

        {watched && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            You&rsquo;ll be notified here when this trend moves by 15% or more.
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          {role ? (
            <>
              <SalaryTrendChart rows={chartRows} />
              <form action="/api/salary-trends/watch" method="POST" className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <input type="hidden" name="role" value={role} />
                {level && <input type="hidden" name="level" value={level} />}
                {location && <input type="hidden" name="location" value={location} />}
                {isWatching ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">You&rsquo;re watching this trend &mdash; we&rsquo;ll notify you of a material move.</p>
                ) : (
                  <button type="submit" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                    Watch this trend
                  </button>
                )}
              </form>
            </>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">Enter a role above to see salary trends.</p>
          )}
        </div>
      </div>
    </main>
  )
}
