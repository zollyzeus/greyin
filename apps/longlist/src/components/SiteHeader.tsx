'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Telescope, Menu, X, ChevronDown, Home, MessageSquareHeart, Building2, BookOpen, Users, Briefcase, FlaskConical } from 'lucide-react'
import { PILLARS } from './EcosystemWidget'
import { NotificationBell } from './NotificationBell'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from './ThemeToggle'

const NAV_LINKS = [
  { href: '/roles', label: 'Browse Roles' },
  { href: '/post', label: 'Post a Future Role' },
  { href: '/employer/roles', label: 'My Posted Roles' },
]

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'longlist')

// Same icon-per-pillar mapping the Hub's own header/homepage use -- gives
// "More Platforms" a real visual mark per pillar instead of just a color
// dot, for easier recognition/jump. Kept in sync by hand (no shared
// source), matching this platform's established per-app duplication
// convention.
const PILLAR_ICONS: Record<string, typeof Building2> = {
  deepedge: Building2,
  greymatters: BookOpen,
  saltnpepper: Users,
  flexpro: Briefcase,
  stackworks: FlaskConical,
  longlist: Telescope,
}

// Same collapse-on-mobile shape as every other app's SiteHeader (the
// mobile-clipping fix that shipped platform-wide) -- kept identical here
// rather than reinvented.
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [platformsOpen, setPlatformsOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (active) setIsLoggedIn(!!user)
    })
    return () => { active = false }
  }, [])

  return (
    <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <a href="https://greyin.net" className="flex items-center min-w-0">
          <Telescope className="h-8 w-8 text-amber-700 dark:text-amber-500 flex-shrink-0" />
          <span className="ml-2 text-2xl font-bold text-gray-900 dark:text-gray-50 truncate">Longlist</span>
        </a>

        <nav className="hidden md:flex items-center gap-6 flex-shrink-0">
          <a href="https://greyin.net" className="flex items-center gap-1 text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-400" title="Back to the Greyin ecosystem hub">
            <Home className="h-4 w-4" />
            Home
          </a>
          <div className="relative group">
            <button className="text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-400 transition flex items-center gap-1">
              Explore
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="block px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-amber-700 dark:hover:text-amber-400 transition">
                  {link.label}
                </Link>
              ))}
              <a href="https://greyin.net/feedback?app=longlist" className="flex items-center gap-2 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-amber-700 dark:hover:text-amber-400 transition border-t border-gray-100 dark:border-gray-800" title="Send feedback to the Greyin team">
                <MessageSquareHeart className="h-4 w-4" />
                Feedback
              </a>
            </div>
          </div>
          <div className="relative group">
            <button className="text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-400 transition flex items-center gap-1">
              More Platforms
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
              {OTHER_PILLARS.map((p) => {
                const Icon = PILLAR_ICONS[p.key]
                return (
                  <a key={p.key} href={p.url} className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                      <Icon className="h-4 w-4 flex-shrink-0" style={{ color: p.color }} aria-hidden="true" />
                      {p.label}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{p.description}</div>
                  </a>
                )
              })}
            </div>
          </div>
          {isLoggedIn === true ? (
            <>
                <NotificationBell />
              <Link href="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-400">Dashboard</Link>
              <form action="/auth/logout" method="POST">
                <button type="submit" className="bg-amber-700 text-white px-4 py-2 rounded-lg hover:bg-amber-800 whitespace-nowrap">Sign Out</button>
              </form>
            </>
          ) : isLoggedIn === false ? (
            <>
              <Link href="/login" className="text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-400">Sign In</Link>
              <Link href="/signup" className="bg-amber-700 text-white px-4 py-2 rounded-lg hover:bg-amber-800 whitespace-nowrap">
                Sign Up
              </Link>
            </>
          ) : null}
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 md:hidden flex-shrink-0">
          <ThemeToggle />
          <button
            type="button"
            className="p-2 -mr-2 text-gray-700 dark:text-gray-300"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-4 space-y-1">
          <a href="https://greyin.net" className="flex items-center gap-2 py-2.5 text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-400" onClick={() => setMobileOpen(false)}>
            <Home className="h-4 w-4" />
            Home
          </a>

          <button
            type="button"
            className="w-full flex items-center justify-between py-2.5 text-gray-700 dark:text-gray-300"
            onClick={() => setExploreOpen((v) => !v)}
            aria-expanded={exploreOpen}
          >
            Explore
            <ChevronDown className={`h-4 w-4 transition-transform ${exploreOpen ? 'rotate-180' : ''}`} />
          </button>
          {exploreOpen && (
            <div className="pl-3 space-y-1 pb-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="block py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400" onClick={() => setMobileOpen(false)}>
                  {link.label}
                </Link>
              ))}
              <a href="https://greyin.net/feedback?app=longlist" className="flex items-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-700 dark:hover:text-amber-400" onClick={() => setMobileOpen(false)}>
                <MessageSquareHeart className="h-4 w-4" />
                Feedback
              </a>
            </div>
          )}

          <button
            type="button"
            className="w-full flex items-center justify-between py-2.5 text-gray-700 dark:text-gray-300"
            onClick={() => setPlatformsOpen((v) => !v)}
            aria-expanded={platformsOpen}
          >
            More Platforms
            <ChevronDown className={`h-4 w-4 transition-transform ${platformsOpen ? 'rotate-180' : ''}`} />
          </button>
          {platformsOpen && (
            <div className="pl-3 space-y-1 pb-1">
              {OTHER_PILLARS.map((p) => {
                const Icon = PILLAR_ICONS[p.key]
                return (
                  <a key={p.key} href={p.url} className="flex items-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-400">
                    <Icon className="h-4 w-4 flex-shrink-0" style={{ color: p.color }} aria-hidden="true" />
                    {p.label}
                  </a>
                )
              })}
            </div>
          )}

          <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-2">
            {isLoggedIn === true ? (
              <>
                <NotificationBell />
                <Link href="/dashboard" className="text-center py-2.5 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="w-full text-center py-2.5 bg-amber-700 text-white rounded-lg">
                    Sign Out
                  </button>
                </form>
              </>
            ) : isLoggedIn === false ? (
              <>
                <Link href="/login" className="text-center py-2.5 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg" onClick={() => setMobileOpen(false)}>
                  Sign In
                </Link>
                <Link href="/signup" className="text-center py-2.5 bg-amber-700 text-white rounded-lg" onClick={() => setMobileOpen(false)}>
                  Sign Up
                </Link>
              </>
            ) : null}
          </div>
        </nav>
      )}
    </header>
  )
}
