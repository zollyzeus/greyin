'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Menu, X, ChevronDown, Home, MessageSquareHeart, BookOpen, Users, Briefcase, FlaskConical, Telescope } from 'lucide-react'
import { PILLARS } from './EcosystemWidget'
import { NotificationBell } from './NotificationBell'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/jobs', label: 'Browse Jobs' },
  { href: '/companies', label: 'Companies' },
  { href: '/candidates', label: 'Find Talent' },
  { href: '/search', label: 'Ecosystem Search' },
]

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'deepedge')

// Same icon-per-pillar mapping the Hub's own header/homepage use --
// gives "More Platforms" a real visual mark per pillar instead of just a
// color dot, for easier recognition/jump. Kept in sync by hand (no
// shared source), matching this platform's established per-app
// duplication convention.
const PILLAR_ICONS: Record<string, typeof Building2> = {
  deepedge: Building2,
  greymatters: BookOpen,
  saltnpepper: Users,
  flexpro: Briefcase,
  stackworks: FlaskConical,
  longlist: Telescope,
}

/**
 * One shared header for every public deepedge page instead of each
 * page hand-rolling its own <nav> -- the audit found the homepage and
 * jobs page showing two different nav link sets, and neither had any
 * mobile behavior at all (nav simply had `hidden md:flex` with no
 * replacement, so phone visitors couldn't sign in, sign up, or navigate).
 */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [platformsOpen, setPlatformsOpen] = useState(false)
  // null while checking -- rendering nothing until resolved avoids a
  // flash of "Sign In" for an already-logged-in visitor, which was the
  // actual audited bug (this header used to render Sign In/Sign Up
  // unconditionally, on every page, regardless of session state).
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (active) setIsLoggedIn(!!user)
    })
    return () => { active = false }
  }, [])

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <a href="https://greyin.net" className="flex items-center flex-shrink-0">
            <Building2 className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-2xl font-bold text-gray-900">DeepEdge</span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            <a href="https://greyin.net" className="flex items-center gap-1 text-gray-700 hover:text-indigo-600" title="Back to the Greyin ecosystem hub">
              <Home className="h-4 w-4" />
              Home
            </a>
            <div className="relative group">
              <button className="text-gray-700 hover:text-indigo-600 transition flex items-center gap-1">
                Explore
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                {NAV_LINKS.map((link) => (
                  <Link key={link.href} href={link.href} className="block px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition">
                    {link.label}
                  </Link>
                ))}
                <a href="https://greyin.net/feedback?app=deepedge" className="flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition border-t border-gray-100" title="Send feedback to the Greyin team">
                  <MessageSquareHeart className="h-4 w-4" />
                  Feedback
                </a>
              </div>
            </div>
            <div className="relative group">
              <button className="text-gray-700 hover:text-indigo-600 transition flex items-center gap-1">
                More Platforms
                <ChevronDown className="h-4 w-4" />
              </button>
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                {OTHER_PILLARS.map((p) => {
                  const Icon = PILLAR_ICONS[p.key]
                  return (
                    <a key={p.key} href={p.url} className="block px-4 py-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0">
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <Icon className="h-4 w-4 flex-shrink-0" style={{ color: p.color }} aria-hidden="true" />
                        {p.label}
                      </div>
                      <div className="text-sm text-gray-600">{p.description}</div>
                    </a>
                  )
                })}
              </div>
            </div>
            {isLoggedIn === true ? (
              <>
                <NotificationBell />
                <Link href="/dashboard" className="text-gray-700 hover:text-indigo-600 transition">Dashboard</Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Sign Out</button>
                </form>
              </>
            ) : isLoggedIn === false ? (
              <>
                <Link href="/login" className="text-gray-700 hover:text-indigo-600 transition">Sign In</Link>
                <Link href="/signup" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Get Started</Link>
              </>
            ) : null}
          </nav>

          <button
            type="button"
            className="md:hidden p-2 -mr-2 text-gray-700"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-1">
          <a href="https://greyin.net" className="flex items-center gap-2 py-2.5 text-gray-700 hover:text-indigo-600" onClick={() => setMobileOpen(false)}>
            <Home className="h-4 w-4" />
            Home
          </a>

          <button
            type="button"
            className="w-full flex items-center justify-between py-2.5 text-gray-700"
            onClick={() => setExploreOpen((v) => !v)}
            aria-expanded={exploreOpen}
          >
            Explore
            <ChevronDown className={`h-4 w-4 transition-transform ${exploreOpen ? 'rotate-180' : ''}`} />
          </button>
          {exploreOpen && (
            <div className="pl-3 space-y-1 pb-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="block py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={() => setMobileOpen(false)}>
                  {link.label}
                </Link>
              ))}
              <a href="https://greyin.net/feedback?app=deepedge" className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-indigo-600" onClick={() => setMobileOpen(false)}>
                <MessageSquareHeart className="h-4 w-4" />
                Feedback
              </a>
            </div>
          )}

          <button
            type="button"
            className="w-full flex items-center justify-between py-2.5 text-gray-700"
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
                  <a key={p.key} href={p.url} className="flex items-center gap-2 py-2 text-sm text-gray-600">
                    <Icon className="h-4 w-4 flex-shrink-0" style={{ color: p.color }} aria-hidden="true" />
                    {p.label}
                  </a>
                )
              })}
            </div>
          )}

          <div className="pt-3 border-t border-gray-200 flex flex-col gap-2">
            {isLoggedIn === true ? (
              <>
                <NotificationBell />
                <Link href="/dashboard" className="text-center py-2.5 text-gray-700 border border-gray-300 rounded-lg" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="w-full text-center py-2.5 bg-indigo-600 text-white rounded-lg">
                    Sign Out
                  </button>
                </form>
              </>
            ) : isLoggedIn === false ? (
              <>
                <Link href="/login" className="text-center py-2.5 text-gray-700 border border-gray-300 rounded-lg" onClick={() => setMobileOpen(false)}>
                  Sign In
                </Link>
                <Link href="/signup" className="text-center py-2.5 bg-indigo-600 text-white rounded-lg" onClick={() => setMobileOpen(false)}>
                  Get Started
                </Link>
              </>
            ) : null}
          </div>
        </nav>
      )}
    </header>
  )
}
