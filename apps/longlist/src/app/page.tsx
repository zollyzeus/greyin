import Link from 'next/link'
import { Telescope, Eye, UserCheck, Sparkles, ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { createClient } from '@/lib/supabase/server'
import { PILLARS } from '@/components/EcosystemWidget'

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'longlist')

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { count: openRoleCount } = await supabase
    .from('future_roles_public')
    .select('id', { count: 'exact', head: true })

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-stone-100 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <SiteHeader />

      <div className="bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-800 dark:to-orange-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="inline-block text-sm font-semibold uppercase tracking-wide mb-4 bg-white/15 rounded-full px-4 py-1.5">
            A new Greyin pillar
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-semibold mb-6">Future roles, quietly explored.</h1>
          <p className="text-xl text-amber-50 max-w-2xl mx-auto mb-2">
            Companies post roles they expect to open 3&ndash;12 months from now — anonymously. Browse them
            without anyone knowing you looked. Subscribe to one and your profile reaches that company; say
            nothing, and AI can still surface you if what you&rsquo;re after matches what they&rsquo;ll need.
          </p>
          <p className="text-sm text-amber-100/80 mb-10">{openRoleCount ?? 0} future roles open right now.</p>
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="bg-white text-amber-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-amber-50 transition">
                Join Longlist
              </Link>
              <Link href="/roles" className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/10 transition">
                Browse Future Roles
              </Link>
            </div>
          )}
          {user && (
            <Link href="/roles" className="inline-flex items-center gap-2 bg-white text-amber-700 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-amber-50 transition">
              Browse Future Roles <ArrowRight className="h-5 w-5" />
            </Link>
          )}
          <a href="https://greyin.net/#demo" className="block mt-6 text-sm text-amber-50 underline hover:text-white transition">
            Or explore as a demo user — no signup needed
          </a>
        </div>
      </div>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-7">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mb-5">
              <Eye className="h-6 w-6 text-amber-700 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Look without being seen</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Every role you browse has the company withheld. Nobody knows you looked unless you subscribe.</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-7">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mb-5">
              <UserCheck className="h-6 w-6 text-amber-700 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Subscribe, don&rsquo;t apply</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">One click marks you future-interested. Your profile reaches that company for that role — no cover letter, no commitment.</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-7">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mb-5">
              <Sparkles className="h-6 w-6 text-amber-700 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Or let AI find you</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">State what you&rsquo;d consider next, and a company can be shown your profile against a role you never even saw.</p>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 py-16 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Telescope className="h-10 w-10 text-amber-700 dark:text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-3">Hiring 3&ndash;12 months out?</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-8">
            Post the role without naming your company. See who subscribes, and who AI surfaces from
            profiles that never even saw the listing.
          </p>
          <Link href={user ? '/post' : '/signup'} className="inline-block bg-amber-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-800 transition">
            Post a Future Role
          </Link>
        </div>
      </section>

      {/* Structural sync pass (2026-09-05): Longlist had no ecosystem
          cross-promo section at all, unlike every other pillar homepage. */}
      <div className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">Part of the Greyin ecosystem</p>
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
