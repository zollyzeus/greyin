import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { PenTool } from 'lucide-react'
import { WorkspaceShell } from '@/app/components/WorkspaceShell'

export default async function MyPostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/posts')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, slug, status, created_at, updated_at')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <WorkspaceShell
      activeSection="posts"
      isAdmin={profile?.role === 'admin'}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="My Posts"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">My Posts</h1>
          <Link
            href="/posts/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <PenTool className="w-4 h-4" />
            Write New Post
          </Link>
        </div>

        {posts && posts.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md divide-y dark:bg-gray-900">
            {posts.map((post) => (
              <div key={post.id} className="p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-50">{post.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                    Last updated {new Date(post.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      post.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {post.status}
                  </span>
                  <Link href={`/posts/${post.slug}/edit`} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
            <p className="text-gray-600 dark:text-gray-400">You haven&apos;t written any posts yet.</p>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
