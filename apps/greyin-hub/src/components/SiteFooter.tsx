import Link from 'next/link'
import Image from 'next/image'
import { PILLARS } from './EcosystemWidget'

// Common footer (2026-09-03) -- previously only the homepage had one; every
// other page (dashboard, wishlist, feedback, pivoting, reentry, login,
// admin/*) had none at all. Mounted once in layout.tsx instead of
// per-page, so it's automatically on every route without duplication.
// Wishlist and Feedback used to be top-level SiteHeader nav items --
// moved here, sharing the pillar links' own row (right-aligned, same
// line) rather than crowding the header alongside Home/Pivoting/
// Returning to Work.
export function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Both logo files are fixed dark-navy (near-identical to this
            footer's own bg-gray-900) -- there's no separate light variant,
            so brightness(0) invert(1) forces every non-transparent pixel
            to pure white, the standard technique for placing a dark-only
            logo asset on a dark background. */}
        <div className="flex items-center mb-4">
          <Image src="/logo.png" alt="" width={24} height={24} className="h-6 w-6" style={{ filter: 'brightness(0) invert(1)' }} />
          <Image src="/GreyIn.png" alt="Greyin" width={105} height={17} className="ml-2 h-4 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
        </div>
        <p className="text-sm mb-6">One account, six platforms, built for experienced professionals.</p>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {PILLARS.map((p) => (
              <a key={p.key} href={p.url} className="hover:text-white transition">{p.label}</a>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/wishlist" className="hover:text-white transition">Wishlist</Link>
            <Link href="/feedback" className="hover:text-white transition">Feedback</Link>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Greyin. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
