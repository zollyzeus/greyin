import Link from 'next/link'
import { Building2, BookOpen, Users, Briefcase, FlaskConical, Telescope, Shuffle, RotateCcw } from 'lucide-react'
import { SharePage } from './SharePage'
import { PILLARS } from './EcosystemWidget'

const PILLAR_ICONS: Record<string, typeof Building2> = {
  deepedge: Building2,
  greymatters: BookOpen,
  saltnpepper: Users,
  flexpro: Briefcase,
  stackworks: FlaskConical,
  longlist: Telescope,
}

// Common footer (2026-09-03) -- no page in this app had a footer at all
// before this. Mounted once in layout.tsx so it's on every route. Same
// shape as every other pillar app's own new footer: brand + tagline,
// app-specific nav links, a cross-pillar row, copyright.
// Deliberately theme-invariant -- see apps/greyin-hub/src/components/
// SiteFooter.tsx's own comment: already a dark surface before light/dark
// mode existed, and stays that way in both themes.
export function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center mb-4">
              <Telescope className="h-6 w-6 text-amber-500" />
              <span className="ml-2 text-xl font-bold text-white">Longlist</span>
            </div>
            <p className="text-sm">Future roles, quietly explored.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/roles" className="hover:text-white transition">Browse Roles</Link></li>
              <li><Link href="/post" className="hover:text-white transition">Post a Future Role</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {PILLARS.map((p) => {
              const Icon = PILLAR_ICONS[p.key]
              return (
                <a key={p.key} href={p.url} className="flex items-center gap-1.5 hover:text-white transition">
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: p.color }} aria-hidden="true" />
                  {p.label}
                </a>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="https://greyin.net/pivoting" className="flex items-center gap-1.5 hover:text-white transition">
              <Shuffle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#EA580C' }} aria-hidden="true" />
              Pivoting
            </a>
            <a href="https://greyin.net/reentry" className="flex items-center gap-1.5 hover:text-white transition">
              <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#2563EB' }} aria-hidden="true" />
              Returning to Work
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="https://greyin.net/wishlist" className="hover:text-white transition">Wishlist</a>
            <a href="https://greyin.net/feedback?app=longlist" className="hover:text-white transition">Feedback</a>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm border-t border-gray-800 mt-8 pt-8">
          <SharePage />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm border-t border-gray-800 mt-6 pt-6">
          <a href="https://greyin.net" className="flex items-center gap-2 hover:text-white transition">
            <img src="/logo.png" alt="" className="h-5 w-5 flex-shrink-0" style={{ filter: 'brightness(0) invert(1)' }} aria-hidden="true" />
            <span className="font-bold text-white">Greyin</span>
          </a>
          <p>&copy; {new Date().getFullYear()} Greyin. All rights reserved.</p>
          <a href="https://greyin.net/contact?app=longlist" className="hover:text-white transition">Contact</a>
        </div>
      </div>
    </footer>
  )
}
