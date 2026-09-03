import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { BookOpen, ArrowLeft, PenTool } from 'lucide-react'

export default async function MyPostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/posts')
  }

  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, slug, status, created_at, updated_at')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">GreyMatters</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Posts</h1>
          <Link
            href="/posts/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            <PenTool className="w-4 h-4" />
            Write New Post
          </Link>
        </div>

        {posts && posts.length > 0 ? (
          <div className="bg-white rounded-lg shadow-md divide-y">
            {posts.map((post) => (
              <div key={post.id} className="p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{post.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Last updated {new Date(post.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                      post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {post.status}
                  </span>
                  <Link href={`/posts/${post.slug}/edit`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">You haven&apos;t written any posts yet.</p>
          </div>
        )}
      </div>
    </main>
  )
}
