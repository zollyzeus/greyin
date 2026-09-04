import Link from 'next/link'
import { Hammer, Sparkles, BadgeCheck } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { PILLARS } from '@/components/EcosystemWidget'

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'stackworks')

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-800 dark:to-emerald-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="font-display text-5xl font-semibold mb-6">Build with senior peers. Earn a verified record.</h1>
          <p className="text-xl mb-8">
            Builders post real project asks. Supporters apply, do the work, and walk away with a
            named, checkable record of what they actually shipped.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/signup?track=builder"
              className="bg-white text-teal-700 px-6 py-3 rounded-lg font-semibold hover:bg-teal-50 dark:bg-gray-900 dark:text-teal-400 dark:hover:bg-teal-950/40"
            >
              Post a project as a Builder
            </Link>
            <Link
              href="/signup?track=supporter"
              className="border border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10"
            >
              Join as a Supporter
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <Hammer className="h-12 w-12 text-teal-600 dark:text-teal-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Real asks, not busywork</h3>
            <p className="text-gray-600 dark:text-gray-400">Builders post specific roles on real projects, not a decorative "looking for" tag</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <Sparkles className="h-12 w-12 text-teal-600 dark:text-teal-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">No experience floor</h3>
            <p className="text-gray-600 dark:text-gray-400">Anyone can join as a Supporter and apply — there's no gate to get in the door</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <BadgeCheck className="h-12 w-12 text-teal-600 dark:text-teal-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">A record that means something</h3>
            <p className="text-gray-600 dark:text-gray-400">Every credential is named and attributable, not a self-reported resume bullet</p>
          </div>
        </div>
      </div>

      {/* Ecosystem cross-link -- previously only deepedge's homepage
          promoted the other pillars. */}
      <div className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-2">Part of the Greyin ecosystem</p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">One login, five more platforms</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {OTHER_PILLARS.map((p) => (
              <a key={p.key} href={p.url} className="block rounded-xl border-2 bg-white dark:bg-gray-950 hover:shadow-lg dark:hover:shadow-none transition-shadow p-5" style={{ borderColor: p.color }}>
                <span className="w-2.5 h-2.5 rounded-full inline-block mb-3" style={{ backgroundColor: p.color }} aria-hidden="true" />
                <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-1">{p.label}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{p.description}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
