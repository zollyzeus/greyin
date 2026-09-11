import { createClient } from '@/lib/supabase/server'
import { MessagesSquare, Flag, ExternalLink } from 'lucide-react'

// Ported from apps/saltnpepper-community/src/app/admin/page.tsx (Phase
// 3, pitch-readiness plan). Moderation review, discussions, projects,
// and users are ported fully (simple DB reads/updates). The "AI Quality
// Sweep" action is NOT ported -- it calls sweepUnscoredReplies() (an
// LLM-calling function local to that app's lib/reply-quality.ts), and
// duplicating LLM-calling code across two apps risks behavior drift
// between two copies of the same sweep for a convenience action that
// already runs automatically on a periodic tick and on every dashboard
// visit anyway -- linked out to Salt & Pepper's own admin page instead.
export default async function SaltNPepperAdminPage() {
  const supabase = await createClient()

  const { data: discussions } = await supabase
    .from('discussions')
    .select('id, title')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: projects } = await supabase
    .from('builder_projects')
    .select('id, title')
    .order('created_at', { ascending: false })
    .limit(50)

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Salt & Pepper</h1>
        </div>
        <a href="https://saltnpepper.greyin.net/admin" className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">
          AI Quality Sweep <ExternalLink className="h-3.5 w-3.5" />
        </a>
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
                  <form action="/api/admin/saltnpepper/discussions/clear-flag" method="POST">
                    <input type="hidden" name="discussion_id" value={d.id} />
                    <button type="submit" className="text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">Clear flag</button>
                  </form>
                  <form action="/api/admin/saltnpepper/discussions/delete" method="POST">
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
                  <form action="/api/admin/saltnpepper/discussion-replies/clear-flag" method="POST">
                    <input type="hidden" name="reply_id" value={r.id} />
                    <button type="submit" className="text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">Clear flag</button>
                  </form>
                  <form action="/api/admin/saltnpepper/discussion-replies/delete" method="POST">
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
                <form action="/api/admin/saltnpepper/discussions/delete" method="POST">
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
                <form action="/api/admin/saltnpepper/projects/delete" method="POST">
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
              <form action="/api/admin/saltnpepper/users/update-role" method="POST" className="flex items-center gap-2">
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
  )
}
