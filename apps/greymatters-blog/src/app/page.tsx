import Link from 'next/link'
import { createClient } from './lib/supabase/server'
import { BookOpen, Calendar, User, ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { PILLARS } from './components/EcosystemWidget'

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'greymatters')

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ newsletter_success?: string; newsletter_error?: string }>
}) {
  const { newsletter_success, newsletter_error } = await searchParams
  const supabase = await createClient()
  
  // posts.author_id references auth.users, not public.profiles, so
  // PostgREST can't resolve a `profiles:author_id(...)` embed (no direct FK
  // between the two tables) — a query with it errors out entirely, not just
  // the embedded field, which is why this list was silently coming back
  // empty. Fetch author names separately and merge them in.
  const { data: rawPosts } = await supabase
    .from('posts')
    .select(`
      *,
      categories (name)
    `)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(10)

  const authorIds = Array.from(new Set((rawPosts || []).map((p) => p.author_id).filter(Boolean)))
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
    : { data: [] }
  const authorsById = new Map((authors || []).map((a) => [a.id, a]))
  const posts = (rawPosts || []).map((p) => ({ ...p, profiles: authorsById.get(p.author_id) || null }))

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      {/* Hero */}
      <div className="bg-gradient-to-r from-sky-600 to-cyan-600 dark:from-sky-800 dark:to-cyan-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-display text-5xl font-semibold mb-6">GreyMatters Blog</h1>
          <p className="text-xl opacity-90">
            Insights, stories, and expertise from the Greyin community
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {posts && posts.length > 0 ? (
              posts.map((post: any) => (
                <article key={post.id} className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 overflow-hidden hover:shadow-lg dark:hover:border-gray-700 transition">
                  {post.cover_image_url && (
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-full h-64 object-cover"
                    />
                  )}
                  <div className="p-6">
                    {post.categories && (
                      <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">
                        {post.categories.name}
                      </span>
                    )}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mt-2 mb-3">
                      <Link href={`/posts/${post.slug}`} className="hover:text-sky-600 dark:hover:text-sky-400">
                        {post.title}
                      </Link>
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">{post.excerpt || post.content?.substring(0, 200)}</p>
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-500">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          {post.profiles?.full_name || 'Anonymous'}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(post.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Link
                        href={`/posts/${post.slug}`}
                        className="flex items-center text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium"
                      >
                        Read more
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-12 text-center">
                <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4 dark:text-gray-500" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">No posts yet</h3>
                <p className="text-gray-600 dark:text-gray-400">Check back soon for new content!</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Categories */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">Categories</h3>
              <div className="space-y-2">
                {categories && categories.map((category: any) => (
                  <Link
                    key={category.id}
                    href={`/categories/${category.slug}`}
                    className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-600 dark:hover:text-sky-400 rounded transition"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* About */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">About GreyMatters</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                GreyMatters is the official blog of Greyin, featuring insights on recruitment,
                career development, and industry trends.
              </p>
            </div>

            {/* Newsletter */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">Newsletter</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Get new articles delivered to your inbox.
              </p>
              {newsletter_success && (
                <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2 mb-3">
                  Thanks for subscribing!
                </p>
              )}
              {newsletter_error && (
                <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 mb-3">
                  {decodeURIComponent(newsletter_error)}
                </p>
              )}
              <form action="/api/newsletter/subscribe" method="POST" className="flex gap-2">
                <input type="hidden" name="redirect_to" value="/" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                  className="flex-1 min-w-0 border border-gray-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" className="bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 text-sm font-semibold whitespace-nowrap">
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Ecosystem cross-link -- previously only deepedge's homepage
          promoted the other pillars; a visitor landing directly here had
          no way to discover the rest of the ecosystem existed. */}
      <div className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide mb-2">Part of the Greyin ecosystem</p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">One login, five more platforms</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {OTHER_PILLARS.map((p) => (
              <a key={p.key} href={p.url} className="block rounded-xl border-2 bg-white dark:bg-gray-950 hover:shadow-lg dark:hover:shadow-none transition-shadow p-5" style={{ borderColor: p.color }}>
                <span className="w-2.5 h-2.5 rounded-full inline-block mb-3" style={{ backgroundColor: p.color }} aria-hidden="true" />
                <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-1">{p.label}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{p.description}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

    </main>
  )
}
