'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Briefcase,
  Compass,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  ShieldCheck,
  Home,
  MessageSquareHeart,
  Rss,
  Search,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { PILLARS, PILLAR_ICONS } from './EcosystemWidget'
import { SectionBadge } from './SectionBadge'
import { CommandPalette } from './CommandPalette'
import { FeedbackWishlistModal } from './FeedbackWishlistModal'
import { GuidedTour, replayTour, type TourStep } from './GuidedTour'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/analytics'

/**
 * UI/UX elevation plan, Phase 1 rollout to FlexPro (2026-09-05) -- ported
 * from DeepEdge's WorkspaceShell (proven across all 24 of its
 * authenticated pages). FlexPro's marketplace isn't persona-split the
 * way DeepEdge's candidate/employer journeys are -- anyone can buy and
 * sell gigs from the same account -- so there's no `variant` prop here.
 * Instead the extra sections (Earnings, Admin) are role-additive: shown
 * or hidden based on `role`/`isMentor` props, same conditional the old
 * per-page dashboard bar already used, just moved into the rail.
 */

interface WorkspaceShellProps {
  activeSection?: string
  role?: string | null
  userName: string
  verified: boolean
  greyinScore: number | null
  pageTitle: string
  children: React.ReactNode
}

const BASE_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/feed', label: 'Feed', icon: Rss, key: 'feed' },
  { href: '/gigs', label: 'My Gigs', icon: Package, key: 'gigs' },
  { href: '/client-jobs', label: 'Client Jobs', icon: Briefcase, key: 'client-jobs' },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, key: 'orders' },
  { href: '/profile', label: 'Profile', icon: Settings, key: 'profile' },
] as const

// UI/UX elevation plan, Phase 2 close-out -- "Section badges", keyed
// off notification-link.ts's own TYPE_TO_PILLAR map (the canonical
// record of which types this app owns): order_message/order_status/
// payout_status all surface through the one Orders section.
const NAV_BADGE_TYPES: Record<string, string[]> = {
  orders: ['order_message', 'order_status', 'payout_status'],
}

// UI/UX elevation plan, Phase 5 -- guided tour steps. One list, not a
// per-role split like DeepEdge's: FlexPro's nav is role-additive
// (Earnings/Admin appear on top of the same base nav), not two
// different journeys, so a step whose data-tour target isn't a
// freelancer/admin's own screen is simply skipped by GuidedTour's own
// defensive "not on this persona's screen" fallback rather than needing
// a second full list.
const TOUR_STEPS: TourStep[] = [
  { target: 'nav-dashboard', title: 'Your dashboard', description: 'Home base — active orders, gigs, and activity at a glance.' },
  { target: 'nav-feed', title: 'Feed', description: 'See what’s happening across your network — new posts, discussions, and updates.' },
  { target: 'nav-gigs', title: 'My Gigs', description: 'Manage the gigs you offer as a freelancer.' },
  { target: 'nav-client-jobs', title: 'Client Jobs', description: 'Post work you need done, as a client.' },
  { target: 'nav-earnings', title: 'Earnings', description: 'Track your payouts as a freelancer.' },
  { target: 'nav-orders', title: 'Orders', description: 'Every order you’re buying or selling, with live status updates.' },
  { target: 'nav-profile', title: 'Profile', description: 'Keep your profile sharp — it’s what clients and freelancers see.' },
  { target: 'nav-admin', title: 'Admin', description: 'Platform administration tools.' },
  { target: 'search', title: 'Search everything', description: 'Press ⌘K anytime to jump to jobs, gigs, articles, discussions, projects, or people — across all six Greyin platforms.' },
  { target: 'feedback', title: 'Feedback & Ideas', description: 'Tell us what’s working or missing, or suggest a feature and upvote other members’ ideas.' },
  { target: 'notifications', title: 'Notifications', description: 'Live updates land here the moment something happens — new orders, messages, and more.' },
  { target: 'ecosystem', title: 'Across Greyin', description: 'FlexPro is one of six connected platforms — jump to any of them any time, same login.' },
]

function RailContents({ role, activeSection, userName, verified, greyinScore, onNavigate, onOpenFeedback, onLogNav, onLogPillarSwitch }: {
  role?: string | null
  activeSection?: string
  userName: string
  verified: boolean
  greyinScore: number | null
  onNavigate?: () => void
  onOpenFeedback: () => void
  onLogNav: (key: string) => void
  onLogPillarSwitch: (to: string) => void
}) {
  const nav = [
    ...BASE_NAV.slice(0, 5),
    ...(role === 'freelancer'
      ? [{ href: '/earnings', label: 'Earnings', icon: Wallet, key: 'earnings' }] as const
      : []),
    BASE_NAV[5],
    ...(role === 'admin'
      ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck, key: 'admin' }] as const
      : []),
  ]

  return (
    <>
      <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <a href="https://greyin.net" className="flex items-center gap-2" title="Go to Greyin Hub">
          <Briefcase className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          <span className="text-lg font-bold text-gray-900 dark:text-gray-50">FlexPro</span>
        </a>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {nav.map(({ href, label, icon: Icon, key }) => (
            <Link
              key={key}
              href={href}
              data-tour={`nav-${key}`}
              onClick={() => {
                onLogNav(key)
                onNavigate?.()
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === key
                  ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
              {NAV_BADGE_TYPES[key] && <SectionBadge types={NAV_BADGE_TYPES[key]} />}
            </Link>
          ))}
          <button
            type="button"
            data-testid="rail-feedback-button"
            data-tour="feedback"
            onClick={() => {
              onOpenFeedback()
              onNavigate?.()
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <MessageSquareHeart className="h-4 w-4 shrink-0" aria-hidden="true" />
            Feedback &amp; Ideas
            <SectionBadge types={['feedback_replied']} />
          </button>
        </div>

        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800" data-tour="ecosystem">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Across Greyin
          </p>
          <div className="space-y-0.5" data-testid="pillar-nav">
            <a
              href="https://greyin.net"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 mb-1"
            >
              <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
              Greyin Hub
            </a>
            {PILLARS.map((p) => {
              const Icon = PILLAR_ICONS[p.key]
              return (
                <a
                  key={p.key}
                  href={p.url}
                  onClick={() => p.key !== 'flexpro' && onLogPillarSwitch(p.key)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    p.key === 'flexpro'
                      ? 'font-semibold text-gray-900 dark:text-gray-50'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: p.color }} aria-hidden="true" />
                  {p.label}
                  {p.key === 'flexpro' && <span className="sr-only"> (current)</span>}
                </a>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-gray-200 p-3 space-y-2 shrink-0 dark:border-gray-800">
        {greyinScore != null && (
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/40"
            data-testid="dashboard-score-badge"
          >
            <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Greyin Score</span>{' '}
            <span className="text-sm font-bold text-orange-700 dark:text-orange-400">{greyinScore}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 flex items-center justify-center text-xs font-semibold shrink-0">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <p className="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
            {userName}
            {verified && <span title="Verified Expert"> ✓</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={replayTour}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Compass className="h-4 w-4" aria-hidden="true" /> Replay tour
        </button>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {/* "Logout", not "Sign out" -- the old hand-rolled dashboard
                bar used this exact word, and password-reset.spec.ts
                already depends on it (getByRole('button', { name:
                'Logout' })) to log out and re-verify a new password. */}
            <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
          </button>
        </form>
      </div>
    </>
  )
}

export function WorkspaceShell({ activeSection, role, userName, verified, greyinScore, pageTitle, children }: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
  }, [supabase])

  const onLogNav = (key: string) => {
    if (userId) logEvent(supabase, userId, 'rail_nav_click', { key })
  }
  const onLogPillarSwitch = (to: string) => {
    if (userId) logEvent(supabase, userId, 'pillar_switch', { from: 'flexpro', to })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:flex">
      <CommandPalette />
      <FeedbackWishlistModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <GuidedTour steps={TOUR_STEPS} storageKey="flexpro" />

      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
        <RailContents role={role} activeSection={activeSection} userName={userName} verified={verified} greyinScore={greyinScore} onOpenFeedback={() => setFeedbackOpen(true)} onLogNav={onLogNav} onLogPillarSwitch={onLogPillarSwitch} />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside
            data-testid="mobile-rail-drawer"
            className="absolute inset-y-0 left-0 w-72 flex flex-col bg-white dark:bg-gray-900 shadow-xl"
          >
            <RailContents
              role={role}
              activeSection={activeSection}
              userName={userName}
              verified={verified}
              greyinScore={greyinScore}
              onNavigate={() => setMobileOpen(false)}
              onOpenFeedback={() => setFeedbackOpen(true)}
              onLogNav={onLogNav}
              onLogPillarSwitch={onLogPillarSwitch}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:bg-gray-950/80 dark:border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-1.5 -ml-1.5 text-gray-600 dark:text-gray-300"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* p, not h1 -- see DeepEdge's WorkspaceShell for why: a
                second same-text <h1> in the top bar breaks
                getByRole('heading', { name: ... }) strict-mode
                assertions in existing e2e specs. */}
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">{pageTitle}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-tour="search"
              onClick={() => window.dispatchEvent(new Event('greyin:open-search'))}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:border-gray-300 dark:text-gray-400 dark:border-gray-700 dark:hover:border-gray-600"
              aria-label="Search Greyin"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Search
              <kbd className="text-[10px] font-semibold text-gray-400 border border-gray-200 rounded px-1 dark:border-gray-700">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('greyin:open-search'))}
              aria-label="Search Greyin"
              className="sm:hidden p-2 text-gray-700 dark:text-gray-300"
            >
              <Search className="h-5 w-5" />
            </button>
            <div data-tour="notifications">
              <NotificationBell />
            </div>
            <ThemeToggle />
          </div>
        </header>
        {mobileOpen && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="lg:hidden fixed top-4 right-4 z-50 p-1.5 rounded-full bg-white shadow dark:bg-gray-900"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        )}
        <main>{children}</main>
      </div>
    </div>
  )
}
