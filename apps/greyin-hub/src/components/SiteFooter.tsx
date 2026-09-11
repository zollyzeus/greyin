'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
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

// The two cross-pillar tracks live on the Hub itself, so on their own
// pages the footer's brand block leads with the track (icon + name +
// one-liner) rather than the generic Greyin lockup -- same shape as a
// pillar app's own footer heading. Everything else on the Hub keeps the
// Greyin lockup.
const TRACK_BRAND: Record<string, { Icon: typeof Building2; color: string; name: string; tagline: string }> = {
  '/pivoting': {
    Icon: Shuffle,
    color: '#EA580C',
    name: 'Pivoting',
    tagline: 'Career changers, matched to employers who want them.',
  },
  '/reentry': {
    Icon: RotateCcw,
    color: '#2563EB',
    name: 'Returning to Work',
    tagline: 'A career gap, shown with context — not held against you.',
  },
}

// Common footer (2026-09-03, revised 2026-09-06 to match the pillar apps'
// footer). Mounted once in layout.tsx, so it's on every hub route
// (landing, dashboard, pivoting, reentry, wishlist, feedback, admin/*).
// Deliberately theme-invariant -- already a dark surface (bg-gray-900)
// before light/dark mode existed, and stays that way in both.
export function SiteFooter() {
  const pathname = usePathname()
  const track = TRACK_BRAND[pathname]
  const TrackIcon = track?.Icon

  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {track && TrackIcon ? (
          <>
            <div className="flex items-center mb-4">
              <TrackIcon className="h-6 w-6 flex-shrink-0" style={{ color: track.color }} aria-hidden="true" />
              <span className="ml-2 text-xl font-bold text-white">{track.name}</span>
            </div>
            <p className="text-sm mb-6">{track.tagline}</p>
          </>
        ) : (
          <>
            {/* Both logo files are fixed dark-navy (near-identical to this
                footer's own bg-gray-900) -- brightness(0) invert(1) forces
                every non-transparent pixel to pure white. */}
            <div className="flex items-center mb-4">
              <Image src="/logo.png" alt="" width={24} height={24} className="h-6 w-6" style={{ filter: 'brightness(0) invert(1)' }} />
              <Image src="/GreyIn.png" alt="Greyin" width={105} height={17} className="ml-2 h-4 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <p className="text-sm mb-6">One account, six platforms, built for experienced professionals.</p>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm border-t border-gray-800 pt-8">
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
            <Link href="/pivoting" className="flex items-center gap-1.5 hover:text-white transition">
              <Shuffle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#EA580C' }} aria-hidden="true" />
              Pivoting
            </Link>
            <Link href="/reentry" className="flex items-center gap-1.5 hover:text-white transition">
              <RotateCcw className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#2563EB' }} aria-hidden="true" />
              Returning to Work
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/wishlist" className="hover:text-white transition">Wishlist</Link>
            <Link href="/feedback" className="hover:text-white transition">Feedback</Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm border-t border-gray-800 mt-8 pt-8">
          <SharePage />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm border-t border-gray-800 mt-6 pt-6">
          <Link href="/" className="flex items-center gap-2 hover:text-white transition">
            <Image src="/logo.png" alt="" width={20} height={20} className="h-5 w-5" style={{ filter: 'brightness(0) invert(1)' }} />
            <span className="font-bold text-white">Greyin</span>
          </Link>
          <p>&copy; {new Date().getFullYear()} Greyin. All rights reserved.</p>
          <Link href="/contact" className="hover:text-white transition">Contact</Link>
        </div>
      </div>
    </footer>
  )
}
