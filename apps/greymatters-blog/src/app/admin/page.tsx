import { redirect } from 'next/navigation'
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton'
import { createClient } from '@/app/lib/supabase/server'
import { ShieldCheck, Send, Sparkles } from 'lucide-react'
import { WorkspaceShell } from '@/app/components/WorkspaceShell'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; swept?: string; remaining?: string; role_updated?: string }>
}) {
  const { success, error, swept, remaining, role_updated } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, slug, status, author_id')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: comments } = await supabase
    .from('comments')
    .select('id, content, user_id, post_id, status')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  // AI quality-score backlog (048_ai_quality_scores.sql) -- same window
  // sweepUnscoredPosts() itself looks at (50 most-recently-published),
  // so this count matches what "Sweep now" below can actually reach.
  const { data: recentPublishedIds } = await supabase
    .from('posts')
    .select('id')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50)
  const { data: scoredIds } = await supabase
    .from('ai_quality_scores')
    .select('post_id, authenticity_flag')
    .eq('content_type', 'greymatters_post')
  const scoredPostIdSet = new Set((scoredIds || []).map((s) => s.post_id))
  // Phase B2 ("11 new AI enhancements" plan) -- informational only, never
  // auto-hides a post; just a signal for admins reviewing content.
  const authenticityByPostId = new Map((scoredIds || []).map((s) => [s.post_id, s.authenticity_flag]))
  const unscoredCount = (recentPublishedIds || []).filter((p) => !scoredPostIdSet.has(p.id)).length
  const { data: sweepFlag } = await supabase
    .from('llm_feature_flags')
    .select('sweep_interval_minutes, last_swept_at')
    .eq('feature_key', 'greymatters_post_quality')
    .maybeSingle()

  return (
    <WorkspaceShell
      activeSection="admin"
      isAdmin={true}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Admin"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* AI providers/feature flags are platform-wide (llm_providers/
                llm_feature_flags have no per-app scoping), managed from
                this one panel rather than duplicated per app. */}
            <a href="https://stackworks.greyin.net/admin/llm" className="text-sm font-medium text-gray-600 hover:text-blue-600 dark:text-gray-400">
              Manage AI providers →
            </a>
            <form action="/api/admin/digest/send" method="POST">
              <button type="submit" className="flex items-center gap-2 text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                <Send className="h-4 w-4" />
                Send weekly digest
              </button>
            </form>
          </div>
        </div>

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Digest sent to {success} subscriber(s).
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}
        {swept !== undefined && (
          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400">
            Swept {swept} post{swept === '1' ? '' : 's'} — {remaining} still unscored (will be picked up by the next sweep).
          </div>
        )}
        {role_updated && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Role updated.
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                AI Quality Sweep
              </h2>
              <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                {unscoredCount} published post{unscoredCount === 1 ? '' : 's'} without an AI quality score
                {' '}(among the 50 most recent). Every /dashboard visit sweeps up to 3 automatically
                {sweepFlag?.sweep_interval_minutes
                  ? `; a periodic sweep also runs every ${sweepFlag.sweep_interval_minutes} minute${sweepFlag.sweep_interval_minutes === 1 ? '' : 's'} (last ran ${sweepFlag.last_swept_at ? new Date(sweepFlag.last_swept_at).toLocaleString() : 'never yet'}).`
                  : '; no periodic sweep is configured (set an interval in the AI providers panel to enable one).'}
              </p>
            </div>
            <form action="/api/admin/sweep-posts" method="POST">
              <button type="submit" className="flex items-center gap-2 text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap">
                <Sparkles className="h-4 w-4" />
                Sweep now
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">All posts</h2>
          {posts && posts.length > 0 ? (
            <div className="divide-y">
              {posts.map((post) => (
                <div key={post.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{post.title}</p>
                    <span className="text-xs text-gray-500 capitalize dark:text-gray-400">{post.status}</span>
                    {authenticityByPostId.get(post.id) === 'possibly_ai_generated' && (
                      <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-400">⚠ Possibly AI-generated</span>
                    )}
                  </div>
                  {post.status !== 'archived' && (
                    <form action="/api/admin/posts/unpublish" method="POST">
                      <input type="hidden" name="post_id" value={post.id} />
                      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                        Unpublish
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No posts yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Comments</h2>
          {comments && comments.length > 0 ? (
            <div className="divide-y">
              {comments.map((comment) => (
                <div key={comment.id} className="py-3 flex items-center justify-between gap-4">
                  <p className="text-sm text-gray-700 line-clamp-2 dark:text-gray-300">{comment.content}</p>
                  <form action="/api/admin/comments/delete" method="POST">
                    <input type="hidden" name="comment_id" value={comment.id} />
                    <ConfirmSubmitButton confirmMessage="Delete this permanently? This cannot be undone." className="text-sm font-medium text-red-600 hover:text-red-700 whitespace-nowrap dark:text-red-400 dark:hover:text-red-300">
                    Delete
                  </ConfirmSubmitButton>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No comments yet.</p>
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
                    {['author', 'admin'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                    Update
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  )
}
