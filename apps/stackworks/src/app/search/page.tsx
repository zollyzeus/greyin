import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FlaskConical, Search as SearchIcon } from 'lucide-react'
import { EcosystemSearchResults } from '@/components/EcosystemSearchResults'
import { PeopleSearchResults, PersonResult } from '@/components/PeopleSearchResults'
import { parseSearchQuery, explainPersonMatch } from '@/lib/parse-search-query'
import { ThemeToggle } from '@/components/ThemeToggle'

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

  const parsed = query ? await parseSearchQuery(query) : null

  const { data: results } = query && parsed?.intent !== 'people'
    ? await supabase
        .from('platform_search_index')
        .select('*')
        .or(`title.ilike.%${sanitizeForOrFilter(parsed?.keywords || query)}%,description.ilike.%${sanitizeForOrFilter(parsed?.keywords || query)}%`)
        .order('created_at', { ascending: false })
        .limit(30)
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
    people = (data || []).map((p) => ({ ...p, matchReasons: explainPersonMatch(p, parsed) }))
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <FlaskConical className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              <span className="ml-2 text-2xl font-bold">StackWorks</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-gray-50">Search the Greyin Ecosystem</h1>

        <form className="mb-8 flex gap-3">
          <div className="flex-1 flex items-center gap-3 bg-white border border-gray-300 rounded-lg px-4 dark:bg-gray-900 dark:border-gray-700">
            <SearchIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search jobs, gigs, articles, discussions, and projects..."
              className="flex-1 py-3 outline-none dark:bg-gray-950 dark:text-gray-100"
            />
          </div>
          <button type="submit" className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 font-semibold">
            Search
          </button>
        </form>

        {query && (!results || results.length === 0) && people.length === 0 && (
          <p className="text-gray-500 text-sm dark:text-gray-400">No results for &ldquo;{query}&rdquo;.</p>
        )}

        <PeopleSearchResults results={people} />
        <EcosystemSearchResults results={results || []} />
      </div>
    </main>
  )
}
