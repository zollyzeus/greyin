import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { BookOpen, ArrowLeft } from 'lucide-react'
import { ImageUploader } from '@/app/components/ImageUploader'
import { MarkdownEditor } from '@/app/components/MarkdownEditor'

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/posts/new')
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">GreyMatters</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/posts" className="flex items-center text-gray-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to my posts
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Write New Post</h1>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action="/api/posts/create" method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
              <input id="title" name="title" type="text" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div>
              <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700">Excerpt</label>
              <textarea id="excerpt" name="excerpt" rows={2}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="A short summary shown in post listings" />
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Tags</label>
              <input id="tags" name="tags" type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="career-transitions, hiring, remote-work" />
              <p className="mt-1 text-xs text-gray-500">Comma-separated. Readers can browse every post under a tag.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cover image</label>
              <ImageUploader name="cover_image_url" folder="post-covers" />
            </div>

            <MarkdownEditor />

            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-gray-700">Category</label>
              <select id="category_id" name="category_id"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="">No category</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
              <select id="status" name="status" defaultValue="draft"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="draft">Save as draft</option>
                <option value="published">Publish now</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="view_audience" className="block text-sm font-medium text-gray-700">Who can view</label>
                <select id="view_audience" name="view_audience" defaultValue="public"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                  <option value="public">Public</option>
                  <option value="follower">Followers</option>
                  <option value="verified_expert">Verified experts</option>
                </select>
              </div>

              <div>
                <label htmlFor="comment_audience" className="block text-sm font-medium text-gray-700">Who can comment</label>
                <select id="comment_audience" name="comment_audience" defaultValue="public"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                  <option value="public">Public</option>
                  <option value="follower">Followers</option>
                  <option value="verified_expert">Verified experts</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="feed_visibility" className="block text-sm font-medium text-gray-700">Show in followers&rsquo; feed</label>
              <select id="feed_visibility" name="feed_visibility" defaultValue="public"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="public">Public</option>
                <option value="followers">Followers only</option>
                <option value="private">Don&rsquo;t include</option>
              </select>
            </div>

            <button type="submit"
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
              Save Post
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
