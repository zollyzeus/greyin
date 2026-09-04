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

interface FeedItem {
  pillar: string
  content_type: string
  id: string
  title: string
  description: string | null
  occurred_at: string
  path: string
}

/**
 * Cross-pillar followers' feed -- same PILLAR_DOMAINS/PILLAR_LABELS
 * lookup and card shape as EcosystemSearchResults.tsx (037), since feed
 * items routinely point at another app's own domain (053_activity_feed.sql).
 */
export function FeedCard({ item }: { item: FeedItem }) {
  return (
    <a
      href={`${PILLAR_DOMAINS[item.pillar]}${item.path}`}
      className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition dark:bg-gray-900"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-400 uppercase dark:text-gray-500">
            {PILLAR_LABELS[item.pillar]} &middot; {item.content_type.replace('_', ' ')}
          </span>
          <h3 className="font-medium text-gray-900 dark:text-gray-50">{item.title}</h3>
          {item.description && <p className="text-sm text-gray-600 line-clamp-2 dark:text-gray-400">{item.description}</p>}
          <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">{new Date(item.occurred_at).toLocaleDateString()}</p>
        </div>
        <ExternalLink className="h-4 w-4 text-gray-300 flex-shrink-0" />
      </div>
    </a>
  )
}
