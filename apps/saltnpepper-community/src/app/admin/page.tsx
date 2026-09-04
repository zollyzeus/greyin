import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Users, ArrowLeft, ShieldCheck, Sparkles, Flag } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ swept?: string; remaining?: string; role_updated?: string; error?: string }>
}) {
  const { swept, remaining, role_updated, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const { data: discussions } = await supabase
    .from('discussions')
    .select('id, title')
    .order('created_at', { ascending: false })
    .limit(50)

  // AI quality-score backlog (048_ai_quality_scores.sql) -- same window
  // sweepUnscoredReplies() itself looks at (50 most-recent replies), so
  // this count matches what "Sweep now" below can actually reach.
  const { data: recentReplyIds } = await supabase
    .from('discussion_replies')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(50)
  const { data: scoredReplyIds } = await supabase
    .from('ai_quality_scores')
    .select('discussion_reply_id')
    .eq('content_type', 'saltnpepper_reply')
  const scoredReplyIdSet = new Set((scoredReplyIds || []).map((s) => s.discussion_reply_id))
  const unscoredCount = (recentReplyIds || []).filter((r) => !scoredReplyIdSet.has(r.id)).length
  const { data: sweepFlag } = await supabase
    .from('llm_feature_flags')
    .select('sweep_interval_minutes, last_swept_at')
    .eq('feature_key', 'saltnpepper_reply_quality')
    .maybeSingle()

  const { data: projects } = await supabase
    .from('builder_projects')
    .select('id, title')
    .order('created_at', { ascending: false })
    .limit(50)

  // Pre-publish moderation review queue (098): 'pending_check' rows are
  // live posts the fail-open path let through while the LLM was
  // unreachable, awaiting an automatic retry; 'flagged_on_retry' rows are
  // ones that retry later flagged -- a human decides here, nothing is
  // auto-removed.
  const { data: flaggedDiscussions } = await supabase
    .from('discussions')
    .select('id, title, moderation_status')
    .in('moderation_status', ['pending_check', 'flagged_on_retry'])
    .order('created_at', { ascending: false })
    .limit(50)
  const { data: flaggedReplies } = await supabase
    .from('discussion_replies')
    .select('id, body, moderation_status, discussion_id')
    .in('moderation_status', ['pending_check', 'flagged_on_retry'])
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <span className="ml-2 text-2xl font-bold">Salt & Pepper</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-purple-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Admin</h1>
          </div>
          {/* AI providers/feature flags are platform-wide (llm_providers/
              llm_feature_flags have no per-app scoping), managed from
              this one panel rather than duplicated per app. */}
          <a href="https://stackworks.greyin.net/admin/llm" className="text-sm font-medium text-gray-600 hover:text-purple-600 dark:text-gray-400">
            Manage AI providers →
          </a>
        </div>

        {swept !== undefined && (
          <div className="mb-4 rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-700 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-400">
            Swept {swept} repl{swept === '1' ? 'y' : 'ies'} — {remaining} still unscored (will be picked up by the next sweep).
          </div>
        )}
        {role_updated && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Role updated.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                AI Quality Sweep
              </h2>
              <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                {unscoredCount} repl{unscoredCount === 1 ? 'y' : 'ies'} without an AI quality score
                {' '}(among the 50 most recent). Discussion pages and every /dashboard visit sweep up to 3 automatically
                {sweepFlag?.sweep_interval_minutes
                  ? `; a periodic sweep also runs every ${sweepFlag.sweep_interval_minutes} minute${sweepFlag.sweep_interval_minutes === 1 ? '' : 's'} (last ran ${sweepFlag.last_swept_at ? new Date(sweepFlag.last_swept_at).toLocaleString() : 'never yet'}).`
                  : '; no periodic sweep is configured (set an interval in the AI providers panel to enable one).'}
              </p>
            </div>
            <form action="/api/admin/sweep-replies" method="POST">
              <button type="submit" className="flex items-center gap-2 text-sm font-medium bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 whitespace-nowrap">
                <Sparkles className="h-4 w-4" />
                Sweep now
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Flag className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Moderation review
          </h2>
          <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
            Posts fail-opened while the AI moderation check was unreachable (queued for automatic
            retry), or flagged by a retry -- nothing here was auto-removed.
          </p>
          {(flaggedDiscussions?.length || 0) + (flaggedReplies?.length || 0) > 0 ? (
            <div className="divide-y">
              {flaggedDiscussions?.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <span className={`text-xs font-medium ${d.moderation_status === 'flagged_on_retry' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {d.moderation_status === 'flagged_on_retry' ? 'Flagged on retry' : 'Pending re-check'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <form action="/api/admin/discussions/clear-flag" method="POST">
                      <input type="hidden" name="discussion_id" value={d.id} />
                      <button type="submit" className="text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">Clear flag</button>
                    </form>
                    <form action="/api/admin/discussions/delete" method="POST">
                      <input type="hidden" name="discussion_id" value={d.id} />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                    </form>
                  </div>
                </div>
              ))}
              {flaggedReplies?.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium truncate max-w-md">{r.body}</p>
                    <span className={`text-xs font-medium ${r.moderation_status === 'flagged_on_retry' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {r.moderation_status === 'flagged_on_retry' ? 'Flagged reply on retry' : 'Pending re-check reply'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <form action="/api/admin/discussion-replies/clear-flag" method="POST">
                      <input type="hidden" name="reply_id" value={r.id} />
                      <button type="submit" className="text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">Clear flag</button>
                    </form>
                    <form action="/api/admin/discussion-replies/delete" method="POST">
                      <input type="hidden" name="reply_id" value={r.id} />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">Nothing pending or flagged.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Discussions</h2>
          {discussions && discussions.length > 0 ? (
            <div className="divide-y">
              {discussions.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between">
                  <p className="font-medium">{d.title}</p>
                  <form action="/api/admin/discussions/delete" method="POST">
                    <input type="hidden" name="discussion_id" value={d.id} />
                    <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No discussions yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Projects (The Lab)</h2>
          {projects && projects.length > 0 ? (
            <div className="divide-y">
              {projects.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <p className="font-medium">{p.title}</p>
                  <form action="/api/admin/projects/delete" method="POST">
                    <input type="hidden" name="project_id" value={p.id} />
                    <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No projects yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mt-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Users</h2>
          <div className="divide-y">
            {users?.map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                </div>
                <form action="/api/admin/users/update-role" method="POST" className="flex items-center gap-2">
                  <input type="hidden" name="user_id" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 capitalize dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    {['member', 'admin'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">
                    Update
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
