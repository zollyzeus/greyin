import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/server'
import { BookOpen, ArrowLeft, User, Tag } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function TagPostsPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: rawTag } = await params
  const tag = decodeURIComponent(rawTag)
  const supabase = await createClient()

  // posts.author_id references auth.users, not public.profiles, so
  // PostgREST can't resolve a `profiles:author_id(...)` embed — a query with
  // it errors out entirely (same pattern as categories/[slug]). Fetch
  // author names separately and merge them in.
  const { data: rawPosts } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image_url, created_at, author_id')
    .contains('tags', [tag])
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const authorIds = Array.from(new Set((rawPosts || []).map((p) => p.author_id).filter(Boolean)))
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
    : { data: [] }
  const authorsById = new Map((authors || []).map((a) => [a.id, a]))
  const posts = (rawPosts || []).map((p) => ({ ...p, profiles: authorsById.get(p.author_id) || null }))

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <BookOpen className="h-8 w-8 text-sky-600 dark:text-sky-400" />
              <span className="ml-2 text-2xl font-bold">GreyMatters</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="flex items-center text-gray-600 hover:text-blue-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to GreyMatters
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2 dark:text-gray-50">
          <Tag className="h-6 w-6 text-gray-400 dark:text-gray-500" />
          #{tag}
        </h1>

        {posts && posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition dark:bg-gray-900"
              >
                {post.cover_image_url && (
                  <img src={post.cover_image_url} alt={post.title} className="w-full h-40 object-cover" />
                )}
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 dark:text-gray-50">{post.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3 dark:text-gray-400">{post.excerpt}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 dark:text-gray-500">
                    <User className="h-3 w-3" />
                    {post.profiles?.full_name || 'GreyMatters'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center dark:bg-gray-900">
            <p className="text-gray-600 dark:text-gray-400">No articles tagged #{tag} yet</p>
          </div>
        )}
      </div>
    </main>
  )
}
