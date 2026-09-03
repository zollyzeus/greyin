import Link from 'next/link'
import { createClient } from '@/app/lib/supabase/server'
import { BookOpen, Search as SearchIcon, User } from 'lucide-react'
import { EcosystemSearchResults } from '@/app/components/EcosystemSearchResults'
import { PeopleSearchResults, PersonResult } from '@/app/components/PeopleSearchResults'
import { parseSearchQuery } from '@/app/lib/parse-search-query'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = (q || '').trim()

  // SEC-022 (2026-08-26 security audit): these values feed directly
  // into PostgREST .or() filter strings below as raw, unescaped text --
  // a comma starts a new OR-condition, parens group conditions, and
  // braces delimit the array-literal value for the people-search
  // branch's cs.{...} operator. RLS still caps what a successful
  // injection could ever expose, but stripping PostgREST's own
  // DSL-reserved characters here closes the injection itself rather
  // than relying on RLS as the only defense.
  const sanitizeForOrFilter = (s: string) => s.replace(/[,()".{}\\]/g, ' ').trim()
  const supabase = await createClient()

  // posts.author_id references auth.users, not public.profiles, so
  // PostgREST can't resolve a `profiles:author_id(...)` embed — a query with
  // it errors out entirely. Fetch author names separately and merge them in.
  const { data: rawPosts } = query
    ? await supabase
        .from('posts')
        .select('id, title, slug, excerpt, cover_image_url, created_at, author_id')
        .eq('status', 'published')
        .or(`title.ilike.%${sanitizeForOrFilter(query)}%,excerpt.ilike.%${sanitizeForOrFilter(query)}%,content.ilike.%${sanitizeForOrFilter(query)}%`)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] }

  const authorIds = Array.from(new Set((rawPosts || []).map((p) => p.author_id).filter(Boolean)))
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', authorIds)
    : { data: [] }
  const authorsById = new Map((authors || []).map((a) => [a.id, a]))
  const posts = (rawPosts || []).map((p) => ({ ...p, profiles: authorsById.get(p.author_id) || null }))

  const parsed = query ? await parseSearchQuery(query) : null

  const { data: ecosystemResults } = query && parsed?.intent !== 'people'
    ? await supabase
        .from('platform_search_index')
        .select('*')
        .neq('pillar', 'greymatters')
        .or(`title.ilike.%${sanitizeForOrFilter(parsed?.keywords || query)}%,description.ilike.%${sanitizeForOrFilter(parsed?.keywords || query)}%`)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [] }

  let people: PersonResult[] = []
  if (query && parsed?.intent === 'people') {
    let peopleQuery = supabase
      .from('platform_people_index')
      .select('*')
      .or(`full_name.ilike.%${sanitizeForOrFilter(parsed.keywords)}%,skills.cs.{${sanitizeForOrFilter(parsed.keywords)}}`)
      .limit(30)
    if (parsed.min_verified_outcomes != null) {
      peopleQuery = peopleQuery.gte('verified_outcomes_count', parsed.min_verified_outcomes)
    }
    if (parsed.availability) {
      peopleQuery = peopleQuery.eq('availability', parsed.availability)
    }
    if (parsed.location) {
      peopleQuery = peopleQuery.ilike('location', `%${parsed.location}%`)
    }
    const { data } = await peopleQuery
    people = data || []
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">GreyMatters</span>
            </a>
            <nav className="flex gap-6">
              <Link href="/" className="text-gray-700 hover:text-blue-600">Home</Link>
              <Link href="/categories" className="text-gray-700 hover:text-blue-600">Categories</Link>
              <Link href="/search" className="text-blue-600 font-semibold">Search</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Search Articles</h1>

        <form className="mb-8 flex gap-3">
          <div className="flex-1 flex items-center gap-3 bg-white border border-gray-300 rounded-lg px-4">
            <SearchIcon className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by title or content..."
              className="flex-1 py-3 outline-none"
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold">
            Search
          </button>
        </form>

        {query && (
          <p className="text-gray-600 mb-6">
            {posts?.length || 0} result{posts?.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
          </p>
        )}

        {posts && posts.length > 0 && (
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
        )}

        <PeopleSearchResults results={people} />
        <EcosystemSearchResults results={ecosystemResults || []} />
      </div>
    </main>
  )
}
