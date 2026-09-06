'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PILLARS } from './EcosystemWidget'
import { logEvent } from '@/lib/analytics'

const OWN_PILLAR: string = 'longlist'
const PILLAR_URL: Record<string, string> = Object.fromEntries(PILLARS.map((p) => [p.key, p.url]))
const PILLAR_LABEL: Record<string, string> = Object.fromEntries(PILLARS.map((p) => [p.key, p.label]))
const PILLAR_COLOR: Record<string, string> = Object.fromEntries(PILLARS.map((p) => [p.key, p.color]))

interface ContentRow {
  type: string
  pillar: string
  id: string
  title: string
  description: string | null
  path: string
  created_at: string
}

interface PersonRow {
  user_id: string
  full_name: string | null
  current_title: string | null
  skills: string[]
}

type Result =
  | { kind: 'content'; key: string; title: string; subtitle: string; pillar: string; path: string }
  | { kind: 'person'; key: string; title: string; subtitle: string; userId: string }

// Same DSL-reserved-character stripping as every other .or() filter site on
// this platform (SEC-022, apps/*/src/app/search/page.tsx) -- these values
// feed directly into PostgREST's .or() filter string as raw text.
function sanitizeForOrFilter(s: string): string {
  return s.replace(/[,()".{}\\]/g, ' ').trim()
}

/**
 * UI/UX elevation plan, Phase 4 -- ⌘K command palette over the existing
 * platform_search_index (037) / platform_people_index (060), the same two
 * sources /search already queries. Deliberately skips parse-search-query.ts's
 * LLM intent classification: that's a server-side call meant for one
 * deliberate submit on the full search page, not something to round-trip
 * on every keystroke of an instant palette. Queries both indexes directly
 * and in parallel instead -- simpler and fast enough for a debounced
 * typeahead, at the cost of the NL filters (min verified outcomes,
 * availability, location) the full /search page still offers as the
 * fallback deep destination ("View all results" below).
 *
 * Person results always resolve to DeepEdge's own /candidates/[id] --
 * same choice PeopleSearchResults.tsx already made, since that's "the one
 * open, cross-pillar-complete profile page on the platform" regardless of
 * which app the search happened in.
 */
export function CommandPalette() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    // Lets WorkspaceShell's visible search button open the same palette
    // instance without prop-drilling open state through it -- keeps this
    // a fully self-contained drop-in, same convention as
    // NotificationBell/SectionBadge (own auth check, own state, no
    // required props at all).
    const onOpenEvent = () => setOpen(true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('greyin:open-search', onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('greyin:open-search', onOpenEvent)
    }
  }, [open])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
  }, [supabase])

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
      if (userId) logEvent(supabase, userId, 'command_palette_open')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const myRequestId = ++requestIdRef.current
    const term = sanitizeForOrFilter(q)

    const timer = setTimeout(async () => {
      const [contentRes, peopleRes] = await Promise.all([
        supabase
          .from('platform_search_index')
          .select('*')
          .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('platform_people_index')
          .select('user_id, full_name, current_title, skills')
          .or(`full_name.ilike.%${term}%,skills.cs.{${term}}`)
          .limit(4),
      ])

      if (myRequestId !== requestIdRef.current) return

      const contentResults: Result[] = ((contentRes.data as ContentRow[]) || []).map((r) => ({
        kind: 'content',
        key: `content:${r.id}`,
        title: r.title,
        subtitle: r.description || '',
        pillar: r.pillar,
        path: r.path,
      }))
      const peopleResults: Result[] = ((peopleRes.data as PersonRow[]) || []).map((p) => ({
        kind: 'person',
        key: `person:${p.user_id}`,
        title: p.full_name || 'Greyin member',
        subtitle: p.current_title || (p.skills || []).slice(0, 4).join(', '),
        userId: p.user_id,
      }))

      setResults([...peopleResults, ...contentResults])
      setActiveIndex(0)
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query, supabase])

  const resolveHref = (r: Result): { href: string; external: boolean } => {
    if (r.kind === 'person') {
      return OWN_PILLAR === 'deepedge'
        ? { href: `/candidates/${r.userId}`, external: false }
        : { href: `https://deepedge.greyin.net/candidates/${r.userId}`, external: true }
    }
    if (r.pillar === OWN_PILLAR) {
      return { href: r.path, external: false }
    }
    const domain = PILLAR_URL[r.pillar]
    return { href: domain ? `${domain}${r.path}` : r.path, external: !!domain }
  }

  const navigate = (r: Result) => {
    const { href, external } = resolveHref(r)
    if (userId) {
      logEvent(supabase, userId, 'command_palette_navigate', {
        kind: r.kind,
        pillar: r.kind === 'content' ? r.pillar : 'deepedge',
      })
    }
    setOpen(false)
    if (external) {
      window.location.href = href
    } else {
      router.push(href)
    }
  }

  const onKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[activeIndex]) navigate(results[activeIndex])
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 px-4" role="dialog" aria-modal="true" aria-label="Search Greyin">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 dark:border-gray-800">
          <Search className="h-5 w-5 text-gray-400 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDownInput}
            placeholder="Search people, jobs, gigs, articles, discussions, projects..."
            data-testid="command-palette-input"
            className="flex-1 h-full outline-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-semibold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 dark:border-gray-700">ESC</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto" data-testid="command-palette-results">
          {loading && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Searching...</p>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">No results for &ldquo;{query}&rdquo;.</p>
          )}
          {!loading && results.map((r, i) => {
            return (
              <button
                key={r.key}
                type="button"
                data-testid="command-palette-result"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => navigate(r)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                  i === activeIndex ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {r.kind === 'person' ? (
                  <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" aria-hidden="true" />
                ) : (
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: PILLAR_COLOR[r.pillar] }}
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.subtitle}</p>}
                </div>
                {r.kind === 'content' && (
                  <span className="text-[10px] font-medium text-gray-400 shrink-0 mt-0.5">{PILLAR_LABEL[r.pillar] || r.pillar}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
