import { createClient } from '@/lib/supabase/server'
import { BookOpen, ExternalLink } from 'lucide-react'

// Ported from apps/greymatters-blog/src/app/admin/page.tsx (Phase 3,
// pitch-readiness plan). Posts, comments, and users are ported fully
// (simple DB reads/updates). "Send weekly digest" and "AI Quality Sweep"
// are NOT ported -- both call LLM/email-sending functions local to that
// app's own lib -- linked out to GreyMatters' own admin page instead,
// same reasoning as Salt & Pepper's sweep action.
export default async function GreyMattersAdminPage() {
  const supabase = await createClient()

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">GreyMatters</h1>
        </div>
        <a href="https://greymatters.greyin.net/admin" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          AI Quality Sweep &amp; Digest <ExternalLink className="h-3.5 w-3.5" />
        </a>
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
                </div>
                {post.status !== 'archived' && (
                  <form action="/api/admin/greymatters/posts/unpublish" method="POST">
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
                <form action="/api/admin/greymatters/comments/delete" method="POST">
                  <input type="hidden" name="comment_id" value={comment.id} />
                  <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 whitespace-nowrap dark:text-red-400 dark:hover:text-red-300">
                    Delete
                  </button>
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
              <form action="/api/admin/greymatters/users/update-role" method="POST" className="flex items-center gap-2">
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
  )
}
