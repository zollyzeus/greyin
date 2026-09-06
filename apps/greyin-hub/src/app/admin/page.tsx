import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SiteHeader } from '@/components/SiteHeader'
import { ShieldCheck, Bot, BadgeCheck, Briefcase, Trash2, Lightbulb, MessageSquareHeart, Scale } from 'lucide-react'

/**
 * Platform-wide admin lives here, not on any one pillar app -- Greyin
 * Hub has no pillar affiliation of its own, unlike StackWorks/deepedge
 * which each used to host one of these despite both being genuinely
 * cross-pillar (LLM provider config feeds AI scoring across GreyMatters/
 * Salt & Pepper/FlexPro; the eligibility gate affects Verified Expert
 * status across all four marketplace apps). Consolidated here 2026-08-24
 * so there's one place, not two, for admin actions that aren't scoped to
 * a single pillar.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ cleanup_result?: string; cleanup_total?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { cleanup_result: cleanupResult, cleanup_total: cleanupTotal } = await searchParams
  let cleanupBreakdown: Record<string, number> | null = null
  try {
    cleanupBreakdown = cleanupResult ? JSON.parse(cleanupResult) : null
  } catch {
    cleanupBreakdown = null
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Platform Admin</h1>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/admin/llm" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition dark:bg-gray-900">
            <Bot className="h-6 w-6 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">AI Providers</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure LLM providers and per-feature AI scoring access.</p>
          </Link>
          <Link href="/admin/threshold-votes" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition dark:bg-gray-900">
            <BadgeCheck className="h-6 w-6 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">Eligibility Governance</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Member vote results and the live Verified Expert gate settings.</p>
          </Link>
          <Link href="/admin/peer-projects" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition dark:bg-gray-900">
            <Briefcase className="h-6 w-6 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">Peer-Confirmed Projects</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Browse and remove projects, flagged reciprocal ratings shown first.</p>
          </Link>
          <Link href="/admin/wishlist" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition dark:bg-gray-900">
            <Lightbulb className="h-6 w-6 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">Feature Wishlist</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Update status on member-suggested features, export as CSV.</p>
          </Link>
          <Link href="/admin/feedback" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition dark:bg-gray-900">
            <MessageSquareHeart className="h-6 w-6 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">Feedback</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Reply to member feedback submitted from any pillar app.</p>
          </Link>
          <Link href="/admin/bias-audit" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition dark:bg-gray-900">
            <Scale className="h-6 w-6 text-indigo-600 mb-2 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">AI Matching Bias Audit</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Aggregate representation check on AI-surfaced matches, from opt-in self-ID data.</p>
          </Link>
        </div>

        {/* Recommended by docs/emergent_deployment_gap.md's UI/UX audit --
            e2e-suite content (title prefix "E2E ") left live on public
            feeds, most visibly GreyMatters' blog. Idempotent -- running
            with nothing to clean just returns zeros. */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-4 dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">Test Data Cleanup</h2>
          </div>
          <p className="text-sm text-gray-500 mb-3 dark:text-gray-400">
            Removes e2e-suite-generated content (title prefix &ldquo;E2E &rdquo;) from posts, projects, discussions, gigs, and jobs across every app. Safe to re-run.
          </p>
          {cleanupBreakdown && (
            <div className="mb-3 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 dark:bg-gray-950 dark:border-gray-800">
              <p className="font-medium text-gray-800 mb-1 dark:text-gray-100">Last run: {cleanupTotal} row{cleanupTotal === '1' ? '' : 's'} removed</p>
              <ul className="text-gray-500 space-y-0.5 dark:text-gray-400">
                {Object.entries(cleanupBreakdown).map(([table, count]) => (
                  <li key={table}>{table}: {count < 0 ? 'error' : count}</li>
                ))}
              </ul>
            </div>
          )}
          <form action="/api/admin/cleanup-test-data" method="POST">
            <button type="submit" className="text-sm font-medium bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900">
              Run cleanup
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
