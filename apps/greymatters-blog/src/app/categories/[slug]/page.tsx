import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/server'
import { BookOpen, ArrowLeft, User } from 'lucide-react'

export default async function CategoryPostsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: category } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!category) {
    notFound()
  }

  // posts.author_id references auth.users, not public.profiles, so
  // PostgREST can't resolve a `profiles:author_id(...)` embed — a query with
  // it errors out entirely. Fetch author names separately and merge them in.
  const { data: rawPosts } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image_url, created_at, author_id')
    .eq('category_id', category.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const authorIds = Array.from(new Set((rawPosts || []).map((p) => p.author_id).filter(Boolean)))
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
    : { data: [] }
  const authorsById = new Map((authors || []).map((a) => [a.id, a]))
  const posts = (rawPosts || []).map((p) => ({ ...p, profiles: authorsById.get(p.author_id) || null }))

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">GreyMatters</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/categories" className="flex items-center text-gray-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          All categories
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-1">{category.name}</h1>
        {category.description && <p className="text-gray-600 mb-6">{category.description}</p>}

        {posts && posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post: any) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
              >
                {post.cover_image_url && (
                  <img src={post.cover_image_url} alt={post.title} className="w-full h-40 object-cover" />
                )}
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{post.excerpt}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {post.profiles?.full_name || 'GreyMatters'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">No articles in this category yet</p>
          </div>
        )}
      </div>
    </main>
  )
}
