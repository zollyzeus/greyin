'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PersonResult {
  user_id: string
  full_name: string | null
}

/**
 * Renders its own hidden `teammate_ids` input (comma-separated), kept
 * in sync with the selected chips -- the surrounding <form> submits it
 * like any other field, no client-side fetch needed for the actual
 * peer-projects/create POST. Search itself queries
 * platform_people_index directly (already authenticated-readable,
 * same as SiteHeader's own client-side auth check) rather than adding
 * a dedicated API route for what's just a name filter.
 */
export function TeammateTagPicker({ currentUserId }: { currentUserId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonResult[]>([])
  const [selected, setSelected] = useState<PersonResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      const { data } = await createClient()
        .from('platform_people_index')
        .select('user_id, full_name')
        .ilike('full_name', `%${query.trim()}%`)
        .neq('user_id', currentUserId)
        .limit(8)
      setResults((data || []).filter((r) => !selected.some((s) => s.user_id === r.user_id)))
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  function addTeammate(person: PersonResult) {
    setSelected((prev) => [...prev, person])
    setResults((prev) => prev.filter((r) => r.user_id !== person.user_id))
    setQuery('')
  }

  function removeTeammate(userId: string) {
    setSelected((prev) => prev.filter((p) => p.user_id !== userId))
  }

  return (
    <div>
      <label htmlFor="teammate-search" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
        Tag teammates (must already be on Greyin)
      </label>
      <input
        id="teammate-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name..."
        className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700"
        autoComplete="off"
      />
      {results.length > 0 && (
        <div className="mt-1 border border-gray-200 rounded-lg shadow-sm bg-white divide-y divide-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:divide-gray-800">
          {results.map((r) => (
            <button
              key={r.user_id}
              type="button"
              onClick={() => addTeammate(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {r.full_name || 'Unnamed member'}
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((s) => (
            <span key={s.user_id} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-full pl-3 pr-2 py-1 dark:bg-indigo-950/40 dark:text-indigo-400">
              {s.full_name || 'Unnamed member'}
              <button type="button" onClick={() => removeTeammate(s.user_id)} aria-label={`Remove ${s.full_name || 'teammate'}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input type="hidden" name="teammate_ids" value={selected.map((s) => s.user_id).join(',')} />
    </div>
  )
}
