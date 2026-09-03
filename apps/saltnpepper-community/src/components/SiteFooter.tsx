import Link from 'next/link'
import { Users } from 'lucide-react'
import { PILLARS } from './EcosystemWidget'

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'saltnpepper')

// Common footer (2026-09-03) -- no page in this app had a footer at all
// before this. Mounted once in layout.tsx so it's on every route. Same
// shape as every other pillar app's own new footer: brand + tagline,
// app-specific nav links, a cross-pillar row, copyright.
export function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center mb-4">
              <Users className="h-6 w-6 text-purple-400" />
              <span className="ml-2 text-xl font-bold text-white">Salt &amp; Pepper</span>
            </div>
            <p className="text-sm">A senior peer community for honest conversations.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/discussions" className="hover:text-white transition">Discussions</Link></li>
              <li><Link href="/events" className="hover:text-white transition">Events</Link></li>
              <li><Link href="/members" className="hover:text-white transition">Members</Link></li>
              <li><Link href="/mentors" className="hover:text-white transition">Find a Mentor</Link></li>
              <li><Link href="/search" className="hover:text-white transition">Ecosystem Search</Link></li>
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
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm border-t border-gray-800 pt-8">
          {OTHER_PILLARS.map((p) => (
            <a key={p.key} href={p.url} className="flex items-center gap-1.5 hover:text-white transition">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
              {p.label}
            </a>
          ))}
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Salt &amp; Pepper. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
