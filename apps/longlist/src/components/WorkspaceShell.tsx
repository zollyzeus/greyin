'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Telescope,
  LayoutDashboard,
  Compass,
  RotateCcw,
  Send,
  Briefcase,
  Users,
  Home,
  MessageSquareHeart,
  Search,
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
 * UI/UX elevation plan, Phase 1 rollout to Longlist (2026-09-05) --
 * ported from the other five apps' WorkspaceShell. No admin section at
 * all in this app (unlike the other five); the only conditional nav
 * items are "Post a Future Role" / "Your Roles", gated on whether the
 * user has a company profile (set up on DeepEdge, shared across all
 * pillars) -- mirroring the dashboard card's own `company ? (...) : (...)`
 * branch. Several of this app's authenticated pages (`/roles`,
 * `/roles/[id]`, `/employer/roles`, `/employer/roles/[id]/candidates`)
 * previously used the shared `<SiteHeader>` (the public marketing nav,
 * which also happens to handle a logged-in state) rather than this
 * app's own hand-rolled dashboard bar -- adopting `WorkspaceShell` here
 * too keeps every authenticated page's chrome consistent, matching how
 * the other five apps' auth-gated pages were converted regardless of
 * which header they started from.
 */

interface WorkspaceShellProps {
  activeSection?: string
  hasCompany?: boolean
  userName: string
  verified: boolean
  greyinScore: number | null
  pageTitle: string
  children: React.ReactNode
}

const BASE_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/roles', label: 'Browse Future Roles', icon: Compass, key: 'roles' },
  { href: '/profile', label: 'Profile', icon: Send, key: 'profile' },
] as const

// UI/UX elevation plan, Phase 2 close-out -- "Section badges", keyed
// off notification-link.ts's own TYPE_TO_PILLAR map (the canonical
// record of which types this app owns): both types are the employer
// side of the posted-role lifecycle (a member subscribed / the role got
// auto-filled), so they surface on Your Roles.
const NAV_BADGE_TYPES: Record<string, string[]> = {
  'employer-roles': ['future_role_subscribed', 'future_role_filled'],
}

// UI/UX elevation plan, Phase 5 -- guided tour steps. One list; the
// company-only Post/Your Roles items are simply skipped by GuidedTour's
// own "not on this persona's screen" fallback for members without a
// company profile.
const TOUR_STEPS: TourStep[] = [
  { target: 'nav-dashboard', title: 'Your dashboard', description: 'Home base — future roles you’re watching, and your Greyin Score.' },
  { target: 'nav-roles', title: 'Browse Future Roles', description: 'Companies post roles they expect to open 3-12 months out — anonymized, quietly explored.' },
  { target: 'nav-post', title: 'Post a Future Role', description: 'As a company, let members subscribe as future-interested ahead of an opening.' },
  { target: 'nav-employer-roles', title: 'Your Roles', description: 'See who’s subscribed as future-interested to the roles you’ve posted.' },
  { target: 'nav-profile', title: 'Profile', description: 'Keep your profile sharp, and set your own future interests.' },
  { target: 'search', title: 'Search everything', description: 'Press ⌘K anytime to jump to jobs, gigs, articles, discussions, projects, or people — across all six Greyin platforms.' },
  { target: 'feedback', title: 'Feedback & Ideas', description: 'Tell us what’s working or missing, or suggest a feature and upvote other members’ ideas.' },
  { target: 'notifications', title: 'Notifications', description: 'Live updates land here the moment something happens — new subscribers, filled roles, and more.' },
  { target: 'ecosystem', title: 'Across Greyin', description: 'Longlist is one of six connected platforms — jump to any of them any time, same login.' },
]

function RailContents({ hasCompany, activeSection, userName, verified, greyinScore, onNavigate, onOpenFeedback, onLogNav, onLogPillarSwitch }: {
  hasCompany?: boolean
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
    ...BASE_NAV.slice(0, 2),
    ...(hasCompany
      ? [
          { href: '/post', label: 'Post a Future Role', icon: Briefcase, key: 'post' } as const,
          { href: '/employer/roles', label: 'Your Roles', icon: Users, key: 'employer-roles' } as const,
        ]
      : []),
    BASE_NAV[2],
  ]

  return (
    <>
      <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <a href="https://greyin.net" className="flex items-center gap-2" title="Go to Greyin Hub">
          <Telescope className="h-6 w-6 text-amber-700 dark:text-amber-400" />
          <span className="text-lg font-bold text-gray-900 dark:text-gray-50">Longlist</span>
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
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
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
                  onClick={() => p.key !== 'longlist' && onLogPillarSwitch(p.key)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    p.key === 'longlist'
                      ? 'font-semibold text-gray-900 dark:text-gray-50'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: p.color }} aria-hidden="true" />
                  {p.label}
                  {p.key === 'longlist' && <span className="sr-only"> (current)</span>}
                </a>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-gray-200 p-3 space-y-2 shrink-0 dark:border-gray-800">
        {greyinScore != null && (
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40"
            data-testid="dashboard-score-badge"
          >
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Greyin Score</span>{' '}
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{greyinScore}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 flex items-center justify-center text-xs font-semibold shrink-0">
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
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Replay tour
        </button>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {/* "Logout", matching the old hand-rolled dashboard bar's
                exact word -- same lesson as the other apps' shells. */}
            <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
          </button>
        </form>
      </div>
    </>
  )
}

export function WorkspaceShell({ activeSection, hasCompany, userName, verified, greyinScore, pageTitle, children }: WorkspaceShellProps) {
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
    if (userId) logEvent(supabase, userId, 'pillar_switch', { from: 'longlist', to })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:flex">
      <CommandPalette />
      <FeedbackWishlistModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <GuidedTour steps={TOUR_STEPS} storageKey="longlist" />

      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
        <RailContents hasCompany={hasCompany} activeSection={activeSection} userName={userName} verified={verified} greyinScore={greyinScore} onOpenFeedback={() => setFeedbackOpen(true)} onLogNav={onLogNav} onLogPillarSwitch={onLogPillarSwitch} />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside
            data-testid="mobile-rail-drawer"
            className="absolute inset-y-0 left-0 w-72 flex flex-col bg-white dark:bg-gray-900 shadow-xl"
          >
            <RailContents
              hasCompany={hasCompany}
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
            {/* p, not h1 -- see DeepEdge's WorkspaceShell for why. */}
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
