'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, Building2, BookOpen, Users, Briefcase, FlaskConical, Telescope } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PILLARS } from './EcosystemWidget'
import { ThemeToggle } from './ThemeToggle'

const NAV_LINKS = [
  { href: '/pivoting', label: 'Pivoting' },
  { href: '/reentry', label: 'Returning to Work' },
]

// Same icon-per-pillar mapping the homepage's own PILLAR_ICONS uses --
// kept in sync by hand (no shared source, matching this platform's
// established per-file-duplication convention) rather than importing
// from page.tsx, which isn't a valid import target for a client component.
const PILLAR_ICONS: Record<string, typeof Building2> = {
  deepedge: Building2,
  greymatters: BookOpen,
  saltnpepper: Users,
  flexpro: Briefcase,
  stackworks: FlaskConical,
  longlist: Telescope,
}

/**
 * Deliberately not the marketplace SiteHeader pattern the other 5 apps
 * share (no "More Platforms" dropdown -- this app *is* the ecosystem
 * front door, the pillar carousel on / already covers that job).
 *
 * Auth-aware -- this used to show Sign In and Dashboard unconditionally,
 * which was actively wrong on /dashboard itself (a login-required page
 * showing "Sign In" to someone who is, by definition, already signed in
 * to be looking at it). Checked client-side since this header renders on
 * both public pages and /dashboard with no shared server-side prop.
 */
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const onDashboard = pathname === '/dashboard'
  // null while checking -- render nothing until resolved rather than
  // flash the wrong state.
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (active) setIsLoggedIn(!!user)
    })
    return () => { active = false }
  }, [])

  return (
    <header className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center flex-shrink-0">
            <span className="relative inline-block w-9 h-9 flex-shrink-0">
              <Image src="/logo_bgnd.png" alt="" fill className="object-contain" priority />
              {/* Both logo files are fixed dark-navy with no separate
                  light variant -- dark:brightness-0 dark:invert forces
                  every non-transparent pixel to white only when the
                  header itself is dark, the same technique SiteFooter.tsx
                  uses unconditionally since its background never changes. */}
              <Image src="/logo.png" alt="" width={26} height={26} className="absolute inset-0 m-auto h-[26px] w-[26px] dark:brightness-0 dark:invert" priority />
            </span>
            <Image src="/GreyIn.png" alt="Greyin" width={130} height={21} className="ml-2 h-5 w-auto dark:brightness-0 dark:invert" priority />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {/* Pillar jump row -- previously the only way to reach a
                pillar from inside the Hub was the homepage's own grid;
                every other page (dashboard, wishlist, pivoting, etc.) had
                no cross-pillar links at all. Icon-only + title tooltip to
                stay compact next to Pivoting/Returning to Work. Icon size
                (h-7 w-7) matches the homepage's own pillar-card icons. */}
            <div className="flex items-center gap-1">
              {PILLARS.map((p) => {
                const Icon = PILLAR_ICONS[p.key]
                return (
                  <a
                    key={p.key}
                    href={p.url}
                    title={p.label}
                    aria-label={p.label}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                    style={{ color: p.color }}
                  >
                    <Icon className="h-7 w-7" />
                  </a>
                )
              })}
            </div>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                {link.label}
              </Link>
            ))}
            {isLoggedIn === true ? (
              <>
                {!onDashboard && (
                  <Link href="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Dashboard</Link>
                )}
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Sign Out</button>
                </form>
              </>
            ) : isLoggedIn === false ? (
              <Link href="/login" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Sign In</Link>
            ) : null}
            <ThemeToggle />
          </nav>

          <div className="flex items-center gap-1 md:hidden">
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
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-4 space-y-1">
          <div className="flex items-center justify-around pb-3 mb-1 border-b border-gray-200 dark:border-gray-800">
            {PILLARS.map((p) => {
              const Icon = PILLAR_ICONS[p.key]
              return (
                <a key={p.key} href={p.url} title={p.label} aria-label={p.label} className="p-2 rounded-lg" style={{ color: p.color }}>
                  <Icon className="h-7 w-7" />
                </a>
              )
            })}
          </div>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="block py-2.5 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => setMobileOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-2">
            {isLoggedIn === true ? (
              <>
                {!onDashboard && (
                  <Link href="/dashboard" className="text-center py-2.5 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg" onClick={() => setMobileOpen(false)}>
                    Dashboard
                  </Link>
                )}
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="w-full text-center py-2.5 bg-indigo-600 text-white rounded-lg">
                    Sign Out
                  </button>
                </form>
              </>
            ) : isLoggedIn === false ? (
              <Link href="/login" className="text-center py-2.5 bg-indigo-600 text-white rounded-lg" onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
            ) : null}
          </div>
        </nav>
      )}
    </header>
  )
}
