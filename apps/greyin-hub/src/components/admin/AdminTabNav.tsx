'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Consolidated admin panel (Phase 3, pitch-readiness plan) -- one tab bar
// covering site-wide/cross-pillar admin (the 9 pages already living under
// /admin/* before this phase, unmoved -- "Site-wide" just links back to
// /admin, the existing card-grid landing page) plus one tab per pillar,
// each hosting a ported copy of that app's own admin actions so an admin
// never has to separately visit 6 other domains to do platform
// maintenance. The old per-pillar /admin pages stay live, unmodified --
// this is an additive consolidation, not a replacement, until proven in
// real use.
const TABS = [
  { label: 'Overview', href: '/admin/overview' },
  { label: 'Payments', href: '/admin/payments' },
  { label: 'Site-wide', href: '/admin' },
  { label: 'DeepEdge', href: '/admin/deepedge' },
  { label: 'FlexPro', href: '/admin/flexpro' },
  { label: 'StackWorks', href: '/admin/stackworks' },
  { label: 'Salt & Pepper', href: '/admin/saltnpepper' },
  { label: 'GreyMatters', href: '/admin/greymatters' },
  { label: 'Longlist', href: '/admin/longlist' },
]

export function AdminTabNav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            // "Site-wide" (/admin) must NOT match every /admin/* subpath --
            // exact match only. Every other tab matches its own subtree.
            const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                  active
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
