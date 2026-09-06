import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { ImageUploader } from '@/app/components/ImageUploader'
import { MarkdownEditor } from '@/app/components/MarkdownEditor'
import { WorkspaceShell } from '@/app/components/WorkspaceShell'

export default async function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/posts/${slug}/edit`)
  }

  const { data: post } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!post) {
    notFound()
  }

  // RLS already restricts updates to the author, but redirect early with a
  // clear message rather than letting a confusing silent-no-op happen below.
  if (post.author_id !== user.id) {
    redirect('/posts')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  return (
    <WorkspaceShell
      activeSection="posts"
      isAdmin={profile?.role === 'admin'}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle={`Edit — ${post.title}`}
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">Edit Post</h1>

          <form action={`/api/posts/${post.slug}/update`} method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input id="title" name="title" type="text" required defaultValue={post.title}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Excerpt</label>
              <textarea id="excerpt" name="excerpt" rows={2} defaultValue={post.excerpt || ''}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
              <input id="tags" name="tags" type="text" defaultValue={(post.tags || []).join(', ')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="career-transitions, hiring, remote-work" />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Comma-separated. Readers can browse every post under a tag.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Cover image</label>
              <ImageUploader name="cover_image_url" defaultValue={post.cover_image_url || ''} folder="post-covers" />
            </div>

            <MarkdownEditor defaultValue={post.content} />

            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select id="category_id" name="category_id" defaultValue={post.category_id || ''}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="">No category</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select id="status" name="status" defaultValue={post.status}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="view_audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Who can view</label>
                <select id="view_audience" name="view_audience" defaultValue={post.view_audience || 'public'}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                  <option value="public">Public</option>
                  <option value="follower">Followers</option>
                  <option value="verified_expert">Verified experts</option>
                </select>
              </div>

              <div>
                <label htmlFor="comment_audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Who can comment</label>
                <select id="comment_audience" name="comment_audience" defaultValue={post.comment_audience || 'public'}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                  <option value="public">Public</option>
                  <option value="follower">Followers</option>
                  <option value="verified_expert">Verified experts</option>
                </select>
              </div>
            </div>

            <button type="submit"
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
              Save Changes
            </button>
          </form>

          <form action={`/api/posts/${post.slug}/delete`} method="POST" className="mt-4">
            <button type="submit"
              className="w-full border border-red-300 text-red-600 px-6 py-3 rounded-lg hover:bg-red-50 font-semibold dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40">
              Delete Post
            </button>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  )
}
