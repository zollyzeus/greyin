import { ExternalLink } from 'lucide-react'

const PILLAR_DOMAINS: Record<string, string> = {
  deepedge: 'https://deepedge.greyin.net',
  greymatters: 'https://greymatters.greyin.net',
  saltnpepper: 'https://saltnpepper.greyin.net',
  flexpro: 'https://flexpro.greyin.net',
  stackworks: 'https://stackworks.greyin.net',
}

const PILLAR_LABELS: Record<string, string> = {
  deepedge: 'DeepEdge',
  greymatters: 'GreyMatters',
  saltnpepper: 'Salt & Pepper',
  flexpro: 'FlexPro',
  stackworks: 'StackWorks',
}

interface SearchResult {
  type: string
  pillar: string
  id: string
  title: string
  description: string | null
  path: string
}

/**
 * Cross-pillar results from platform_search_index — published posts,
 * open jobs, active gigs, discussions, and projects across all five
 * apps. Discussions/projects were excluded here until 037; both sit
 * behind the exact same `auth.role() = 'authenticated'` RLS as the
 * three pillars that were always included, so there was no actual
 * privacy gate being preserved by leaving them out — just a stale
 * search index that predated StackWorks's carve-out.
 */
export function EcosystemSearchResults({ results }: { results: SearchResult[] }) {
  if (results.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">More across Greyin</h2>
      <div className="space-y-3">
        {results.map((r) => (
          <a
            key={`${r.type}-${r.id}`}
            href={`${PILLAR_DOMAINS[r.pillar]}${r.path}`}
            className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition dark:bg-gray-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase dark:text-gray-500">
                  {PILLAR_LABELS[r.pillar]} &middot; {r.type}
                </span>
                <h3 className="font-medium text-gray-900 dark:text-gray-50">{r.title}</h3>
                {r.description && <p className="text-sm text-gray-600 line-clamp-1 dark:text-gray-400">{r.description}</p>}
              </div>
              <ExternalLink className="h-4 w-4 text-gray-300 flex-shrink-0" />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
