'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  Compass,
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquareHeart,
  PlusCircle,
  Rss,
  Search,
  Settings,
  ShieldCheck,
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
 * UI/UX elevation plan, Phase 1 (2026-09-06) -- the persistent left rail
 * this plan has called the single biggest lift since 2026-09-03. Piloted
 * here on DeepEdge only, on /dashboard only, deliberately: this is a real
 * visual restructuring (unlike the notification-polish and score-badge
 * work that shipped overnight, which were either behavioral or one small
 * additive element), so it gets built where it can actually be looked at
 * before being replicated to DeepEdge's other authenticated pages or the
 * other 5 apps -- the same discipline the color-theme revert argued for.
 *
 * Deliberately conservative vs. the plan's original `(app)` route-group
 * design: rather than a mechanical file-moving refactor across every
 * authenticated page up front, this is a drop-in wrapper one page opts
 * into at a time (`<WorkspaceShell {...props}>{children}</WorkspaceShell>`
 * replacing that page's own hand-rolled header). Same end state once
 * every authenticated page has adopted it; lower blast radius getting
 * there, and each page's adoption is independently reviewable.
 *
 * Composes the already-proven pieces from the rest of this plan rather
 * than inventing new ones: NotificationBell and ThemeToggle (unchanged),
 * PILLARS (the canonical cross-app color/URL source EcosystemWidget
 * already uses) for the "Across Greyin" section, and the same
 * `greyin_score != null` gating the dashboard-score-badge feature
 * already established -- no score shown rather than a misleading 0.
 *
 * Data (user name, verified state, score) is fetched server-side by the
 * page and passed in as props, same as every other value that page
 * already computes -- this component itself only owns the rail's own
 * open/closed (mobile) and active-highlight (client-only, needs
 * usePathname) state.
 *
 * 2026-09-06 (rollout to the rest of DeepEdge's authenticated pages):
 * `activeSection` widened to a plain string -- most of the ~20 remaining
 * authenticated pages (messages, notifications, admin, subscribe,
 * governance, salary-trends, references, enterprise-contact, the
 * jobs/apply and employer/jobs/[id]/* detail pages) don't correspond to
 * any single rail nav item, and that's fine: the rail's value on those
 * pages is persistent identity/score/cross-pillar nav, not a highlighted
 * match. Added `variant` for the employer nav (a genuinely different set
 * of sections, not a re-theme) since `employer/dashboard` and its
 * siblings are a different persona's primary journey through this app.
 */

interface WorkspaceShellProps {
  activeSection?: string
  variant?: 'candidate' | 'employer'
  role?: string | null
  userName: string
  verified: boolean
  greyinScore: number | null
  pageTitle: string
  children: React.ReactNode
}

// Preserves every destination the old per-page dashboard bar linked
// one-click-away (Feed, Profile) alongside the sections that bar never
// had at all (Applications, Find Talent) -- the migration to this shell
// is additive to reachability, not a narrowing of it.
const CANDIDATE_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/feed', label: 'Feed', icon: Rss, key: 'feed' },
  { href: '/jobs', label: 'Browse Jobs', icon: Briefcase, key: 'jobs' },
  { href: '/dashboard/applications', label: 'My Applications', icon: FileText, key: 'applications' },
  { href: '/candidates', label: 'Find Talent', icon: Users, key: 'candidates' },
  { href: '/profile', label: 'Profile', icon: Settings, key: 'profile' },
] as const

// Employer's own primary journey -- a different set of sections
// entirely, not the candidate nav re-themed. Matches exactly what
// employer/dashboard's own old bar linked (Post Job, Browse Candidates,
// Feed, Messages, Settings) -- that page's hand-rolled bell (a static
// unread count + link, not the live NotificationBell dropdown every
// other page already has) is a strict downgrade this migration fixes
// as a side effect, not a scope increase.
const EMPLOYER_NAV = [
  { href: '/employer/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'employer-dashboard' },
  { href: '/employer/post-job', label: 'Post Job', icon: PlusCircle, key: 'post-job' },
  { href: '/candidates', label: 'Browse Candidates', icon: Users, key: 'candidates' },
  { href: '/feed', label: 'Feed', icon: Rss, key: 'feed' },
  { href: '/messages', label: 'Messages', icon: MessageCircle, key: 'messages' },
  { href: '/employer/settings', label: 'Company Settings', icon: Settings, key: 'employer-settings' },
] as const

// UI/UX elevation plan, Phase 2 close-out -- "Section badges": unread
// counts on rail items whose notification `type` maps to that section.
// Keyed off notification-link.ts's own TYPE_TO_PILLAR map (the canonical
// record of which types this app owns): candidates only ever see their
// own application_status changes (application_new is the employer-side
// "someone applied" signal, and there's no candidate nav item for it);
// employers only have a Messages section, not a per-job applications
// list, in the persistent nav.
const NAV_BADGE_TYPES: Record<string, string[]> = {
  applications: ['application_status'],
  messages: ['direct_message'],
}

// UI/UX elevation plan, Phase 5 -- persona-aware guided tour steps.
// Candidate and employer get entirely different step lists (matching
// CANDIDATE_NAV/EMPLOYER_NAV's own split) rather than one generic list
// filtered down, since the two journeys don't just add/remove a couple
// of items -- they're different primary journeys through the same app
// (WorkspaceShell's own top comment). The shared tail (search, feedback,
// notifications, ecosystem) is identical for both.
const SHARED_TOUR_TAIL: TourStep[] = [
  { target: 'search', title: 'Search everything', description: 'Press ⌘K anytime to jump to jobs, gigs, articles, discussions, projects, or people — across all six Greyin platforms.' },
  { target: 'feedback', title: 'Feedback & Ideas', description: 'Tell us what’s working or missing, or suggest a feature and upvote other members’ ideas.' },
  { target: 'notifications', title: 'Notifications', description: 'Live updates land here the moment something happens — application replies, new messages, and more.' },
  { target: 'ecosystem', title: 'Across Greyin', description: 'DeepEdge is one of six connected platforms — jump to any of them any time, same login.' },
]

const CANDIDATE_TOUR_STEPS: TourStep[] = [
  { target: 'nav-dashboard', title: 'Your dashboard', description: 'Home base — your applications, matches, and Greyin Score at a glance.' },
  { target: 'nav-feed', title: 'Feed', description: 'See what’s happening across your network — new posts, discussions, and updates.' },
  { target: 'nav-jobs', title: 'Browse Jobs', description: 'Search and filter open roles across every company on DeepEdge.' },
  { target: 'nav-applications', title: 'My Applications', description: 'Track every job you’ve applied to and its current status.' },
  { target: 'nav-candidates', title: 'Find Talent', description: 'See how employers browse the Greyin candidate pool — useful once you’re on the other side of the table too.' },
  { target: 'nav-profile', title: 'Profile', description: 'Keep your profile sharp — it’s what employers and the rest of the ecosystem see.' },
  { target: 'nav-admin', title: 'Admin', description: 'Platform administration tools.' },
  ...SHARED_TOUR_TAIL,
]

const EMPLOYER_TOUR_STEPS: TourStep[] = [
  { target: 'nav-employer-dashboard', title: 'Your dashboard', description: 'Home base for hiring — open roles, new applicants, and activity at a glance.' },
  { target: 'nav-post-job', title: 'Post Job', description: 'Publish a new opening in a couple of minutes.' },
  { target: 'nav-candidates', title: 'Browse Candidates', description: 'Search the Greyin candidate pool directly, beyond just who applied.' },
  { target: 'nav-feed', title: 'Feed', description: 'See what’s happening across your network — new posts, discussions, and updates.' },
  { target: 'nav-messages', title: 'Messages', description: 'Direct conversations with candidates, in one place.' },
  { target: 'nav-employer-settings', title: 'Company Settings', description: 'Manage your company profile and job-post credits.' },
  { target: 'nav-admin', title: 'Admin', description: 'Platform administration tools.' },
  ...SHARED_TOUR_TAIL,
]

function RailContents({ variant, role, activeSection, userName, verified, greyinScore, onNavigate, onOpenFeedback, onLogNav, onLogPillarSwitch }: {
  variant: 'candidate' | 'employer'
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
  const nav = variant === 'employer' ? EMPLOYER_NAV : CANDIDATE_NAV
  return (
    <>
      <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <a href="https://greyin.net" className="flex items-center gap-2" title="Go to Greyin Hub">
          <Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <span className="text-lg font-bold text-gray-900 dark:text-gray-50">DeepEdge</span>
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
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
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

        {role === 'admin' && (
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
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
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
                  onClick={() => p.key !== 'deepedge' && onLogPillarSwitch(p.key)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    p.key === 'deepedge'
                      ? 'font-semibold text-gray-900 dark:text-gray-50'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: p.color }} aria-hidden="true" />
                  {p.label}
                  {p.key === 'deepedge' && <span className="sr-only"> (current)</span>}
                </a>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-gray-200 p-3 space-y-2 shrink-0 dark:border-gray-800">
        {greyinScore != null && (
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40"
            data-testid="dashboard-score-badge"
          >
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Greyin Score</span>{' '}
            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{greyinScore}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 flex items-center justify-center text-xs font-semibold shrink-0">
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
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>
    </>
  )
}

export function WorkspaceShell({ activeSection, variant = 'candidate', role, userName, verified, greyinScore, pageTitle, children }: WorkspaceShellProps) {
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
    if (userId) logEvent(supabase, userId, 'pillar_switch', { from: 'deepedge', to })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 lg:flex">
      <CommandPalette />
      <FeedbackWishlistModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <GuidedTour steps={variant === 'employer' ? EMPLOYER_TOUR_STEPS : CANDIDATE_TOUR_STEPS} storageKey="deepedge" />

      {/* Desktop rail -- persistent, fixed width, full height */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
        <RailContents variant={variant} role={role} activeSection={activeSection} userName={userName} verified={verified} greyinScore={greyinScore} onOpenFeedback={() => setFeedbackOpen(true)} onLogNav={onLogNav} onLogPillarSwitch={onLogPillarSwitch} />
      </aside>

      {/* Mobile rail -- slide-over drawer, same content */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside
            data-testid="mobile-rail-drawer"
            className="absolute inset-y-0 left-0 w-72 flex flex-col bg-white dark:bg-gray-900 shadow-xl"
          >
            <RailContents
              variant={variant}
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

      {/* Content column */}
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
            {/* p, not h1 -- the page's own content supplies the real <h1>;
                a second same-text <h1> in the top bar broke every e2e
                assertion doing getByRole('heading', { name: ... }) with
                a strict-mode violation (found via admin.spec.ts /
                employer-settings.spec.ts / enterprise-solutions.spec.ts
                during this rollout's own regression pass). */}
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
