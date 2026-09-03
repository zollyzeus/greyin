import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { PILLARS } from './EcosystemWidget'

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'deepedge')

// Common footer (2026-09-03) -- previously only the homepage had one;
// every other page (jobs, candidates, dashboard, login, etc.) had none.
// Mounted once in layout.tsx instead of per-page. Content unchanged from
// the original homepage-only version except the new cross-pillar row
// (this app's own header already has a "More Platforms" dropdown; the
// footer had no equivalent at all until now, unlike every other pillar's
// footer being built alongside this one).
export function SiteFooter() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center mb-4">
              <Building2 className="h-6 w-6 text-indigo-400" />
              <span className="ml-2 text-xl font-bold text-white">DeepEdge</span>
            </div>
            <p className="text-sm">Connecting companies with top talent worldwide.</p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">For Companies</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/employer/post-job" className="hover:text-white transition">Post a Job</Link></li>
              <li><Link href="/solutions" className="hover:text-white transition">Solutions</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
              <li><Link href="/candidates" className="hover:text-white transition">Browse Candidates</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">For Candidates</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/jobs" className="hover:text-white transition">Browse Jobs</Link></li>
              <li><Link href="/companies" className="hover:text-white transition">Companies</Link></li>
              <li><a href="https://greymatters.greyin.net" className="hover:text-white transition">Career Advice</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
              <li><Link href="/enterprise-contact" className="hover:text-white transition">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm border-t border-gray-800 mt-8 pt-8">
          {OTHER_PILLARS.map((p) => (
            <a key={p.key} href={p.url} className="flex items-center gap-1.5 hover:text-white transition">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} aria-hidden="true" />
              {p.label}
            </a>
          ))}
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} DeepEdge. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
