'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Compass,
  LayoutDashboard,
  Rss,
  FileText,
  PenTool,
  MessageSquareHeart,
  Search,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from '@/components/ThemeToggle'
import { PILLARS, PILLAR_ICONS } from './EcosystemWidget'
import { SectionBadge } from './SectionBadge'
import { CommandPalette } from './CommandPalette'
import { FeedbackWishlistModal } from './FeedbackWishlistModal'
import { GuidedTour, replayTour, type TourStep } from './GuidedTour'
import { createClient } from '@/app/lib/supabase/client'
import { logEvent } from '@/app/lib/analytics'

/**
 * UI/UX elevation plan, Phase 1 rollout to GreyMatters (2026-09-05) --
 * ported from DeepEdge/FlexPro/StackWorks/Salt & Pepper's WorkspaceShell.
 * Same simple shape as Salt & Pepper: every user is just "Author," with
 * only an `isAdmin` flag layered on top, no derived eligibility or
 * persona split.
 */

interface WorkspaceShellProps {
  activeSection?: string
  isAdmin?: boolean
  userName: string
  verified: boolean
  greyinScore: number | null
  pageTitle: string
  children: React.ReactNode
}

const BASE_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/feed', label: 'Feed', icon: Rss, key: 'feed' },
  { href: '/posts', label: 'My Posts', icon: FileText, key: 'posts' },
  { href: '/posts/new', label: 'Write New Post', icon: PenTool, key: 'posts-new' },
  { href: '/profile', label: 'Profile', icon: Settings, key: 'profile' },
] as const

// UI/UX elevation plan, Phase 2 close-out -- "Section badges", keyed
// off notification-link.ts's own TYPE_TO_PILLAR map (the canonical
// record of which types this app owns): post_comment surfaces on My
// Posts, since that's where a comment on your own post actually leads.
const NAV_BADGE_TYPES: Record<string, string[]> = {
  posts: ['post_comment'],
}

// UI/UX elevation plan, Phase 5 -- guided tour steps. One list; the
// admin-only Admin item is simply skipped by GuidedTour's own "not on
// this persona's screen" fallback for non-admin authors.
const TOUR_STEPS: TourStep[] = [
  { target: 'nav-dashboard', title: 'Your dashboard', description: 'Home base — your posts, comments, and Greyin Score at a glance.' },
  { target: 'nav-feed', title: 'Feed', description: 'See what’s happening across your network — new posts, discussions, and updates.' },
  { target: 'nav-posts', title: 'My Posts', description: 'Everything you’ve written, and how it’s performing.' },
  { target: 'nav-posts-new', title: 'Write New Post', description: 'Publish a new article to the Greyin community.' },
  { target: 'nav-admin', title: 'Admin', description: 'Content moderation and administration tools.' },
  { target: 'nav-profile', title: 'Profile', description: 'Keep your profile sharp — it’s what readers and the rest of the ecosystem see.' },
  { target: 'search', title: 'Search everything', description: 'Press ⌘K anytime to jump to jobs, gigs, articles, discussions, projects, or people — across all six Greyin platforms.' },
  { target: 'feedback', title: 'Feedback & Ideas', description: 'Tell us what’s working or missing, or suggest a feature and upvote other members’ ideas.' },
  { target: 'notifications', title: 'Notifications', description: 'Live updates land here the moment something happens — new comments, and more.' },
  { target: 'ecosystem', title: 'Across Greyin', description: 'GreyMatters is one of six connected platforms — jump to any of them any time, same login.' },
]

function RailContents({ isAdmin, activeSection, userName, verified, greyinScore, onNavigate, onOpenFeedback, onLogNav, onLogPillarSwitch }: {
  isAdmin?: boolean
  activeSection?: string
  userName: string
  verified: boolean
  greyinScore: number | null
  onNavigate?: () => void
  onOpenFeedback: () => void
  onLogNav: (key: string) => void
  onLogPillarSwitch: (to: string) => void
}) {
  const nav = BASE_NAV

  return (
    <>
      <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <a href="https://greyin.net" className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-sky-600 dark:text-sky-400" />
          <span className="text-lg font-bold text-gray-900 dark:text-gray-50">GreyMatters</span>
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
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400'
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

        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
            <Link
              href="/admin"
              data-tour="nav-admin"
              onClick={() => {
                onLogNav('admin')
                onNavigate?.()
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === 'admin'
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Admin
            </Link>
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800" data-tour="ecosystem">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Across Greyin
          </p>
          <div className="space-y-0.5" data-testid="pillar-nav">
            {PILLARS.map((p) => {
              const Icon = PILLAR_ICONS[p.key]
              return (
                <a
                  key={p.key}
                  href={p.url}
                  onClick={() => p.key !== 'greymatters' && onLogPillarSwitch(p.key)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    p.key === 'greymatters'
                      ? 'font-semibold text-gray-900 dark:text-gray-50'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: p.color }} aria-hidden="true" />
                  {p.label}
                  {p.key === 'greymatters' && <span className="sr-only"> (current)</span>}
                </a>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-gray-200 p-3 space-y-2 shrink-0 dark:border-gray-800">
        {greyinScore != null && (
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-950/40"
            data-testid="dashboard-score-badge"
          >
            <span className="text-xs font-medium text-sky-700 dark:text-sky-400">Greyin Score</span>{' '}
            <span className="text-sm font-bold text-sky-700 dark:text-sky-400">{greyinScore}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="h-8 w-8 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400 flex items-center justify-center text-xs font-semibold shrink-0">
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
            {/* "Logout", matching the old hand-rolled dashboard bar's
                exact word -- same lesson as the other apps' shells. */}
            <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
          </button>
        </form>
      </div>
    </>
  )
}

export function WorkspaceShell({ activeSection, isAdmin, userName, verified, greyinScore, pageTitle, children }: WorkspaceShellProps) {
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
    if (userId) logEvent(supabase, userId, 'pillar_switch', { from: 'greymatters', to })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:flex">
      <CommandPalette />
      <FeedbackWishlistModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <GuidedTour steps={TOUR_STEPS} storageKey="greymatters" />

      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
        <RailContents isAdmin={isAdmin} activeSection={activeSection} userName={userName} verified={verified} greyinScore={greyinScore} onOpenFeedback={() => setFeedbackOpen(true)} onLogNav={onLogNav} onLogPillarSwitch={onLogPillarSwitch} />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside
            data-testid="mobile-rail-drawer"
            className="absolute inset-y-0 left-0 w-72 flex flex-col bg-white dark:bg-gray-900 shadow-xl"
          >
            <RailContents
              isAdmin={isAdmin}
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
