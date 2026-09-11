import Link from 'next/link'
import Image from 'next/image'
import { Building2, BookOpen, Users, Briefcase, FlaskConical, Telescope, Shuffle, RotateCcw, ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { PILLARS } from '@/components/EcosystemWidget'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { DEMO_PERSONAS } from '@/lib/demo-personas'
import { VisitTracker } from '@/components/VisitTracker'

const PILLAR_ICONS: Record<string, typeof Building2> = {
  deepedge: Building2,
  greymatters: BookOpen,
  saltnpepper: Users,
  flexpro: Briefcase,
  stackworks: FlaskConical,
  longlist: Telescope,
}

// Deliberately not PILLARS' own array order -- this is a display-only
// arrangement for the homepage grid specifically (two even rows of
// three), not a change to the canonical pillar ordering used everywhere
// else (nav dropdowns, footer, EcosystemSearchResults). Longlist added
// 2026-08-31, filling out row 2 to match row 1's three-across shape.
const ROW_1_KEYS = ['deepedge', 'flexpro', 'stackworks']
const ROW_2_KEYS = ['greymatters', 'saltnpepper', 'longlist']

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Real per-pillar counts, not decoration -- the same reasoning that
  // replaced expertedge's old hardcoded "10,000+" homepage stats applies
  // here: a stale or invented number next to a live product is the
  // fastest way to lose a skeptical visitor's trust.
  //
  // discussions and verified_outcomes specifically use the service-role
  // client, not the anon-scoped one every other count here uses -- both
  // tables' own SELECT RLS requires auth.role()='authenticated' with no
  // public branch at all (found while checking these counts actually
  // reflect freshly-seeded data: an anonymous visitor's own query
  // silently returned 0 regardless of real row count, for every visitor
  // this homepage exists to impress, not something specific to today's
  // seed). Read-only aggregate counts only -- no individual row is ever
  // exposed by a head:true count query.
  const service = createServiceClient()
  const [
    { count: jobCount },
    { count: postCount },
    { count: discussionCount },
    { count: gigCount },
    { count: verifiedCount },
    { count: futureRoleCount },
  ] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    service.from('discussions').select('id', { count: 'exact', head: true }),
    supabase.from('gigs').select('id', { count: 'exact', head: true }),
    service.from('verified_outcomes').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
    supabase.from('future_roles_public').select('id', { count: 'exact', head: true }),
  ])

  const stats: Record<string, string> = {
    deepedge: `${jobCount ?? 0} open jobs`,
    greymatters: `${postCount ?? 0} articles`,
    saltnpepper: `${discussionCount ?? 0} discussions`,
    flexpro: `${gigCount ?? 0} gigs listed`,
    stackworks: `${verifiedCount ?? 0} verified outcomes`,
    longlist: `${futureRoleCount ?? 0} future roles`,
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <VisitTracker />
      <SiteHeader />

      {/* Hero -- common ecosystem copy, not marketplace-flavored (the
          hiring-specific hero lives on deepedge.greyin.net now). Logo +
          wordmark lockup sits above the eyebrow pill, its own row. */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-14 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="relative inline-block w-16 h-16 flex-shrink-0">
            <Image src="/logo_bgnd.png" alt="" fill className="object-contain" priority />
            <Image src="/logo.png" alt="" width={44} height={44} className="absolute inset-0 m-auto h-11 w-11 dark:brightness-0 dark:invert" priority />
          </div>
          <Image src="/GreyIn.png" alt="Greyin" width={220} height={36} className="h-9 w-auto dark:brightness-0 dark:invert" priority />
        </div>
        <p className="inline-block text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-4 bg-indigo-50 dark:bg-indigo-950 rounded-full px-4 py-1.5">
          Built for senior professionals
        </p>
        <h1 className="font-display text-5xl md:text-6xl font-semibold text-gray-900 dark:text-gray-50 mb-6">
          One account. Six platforms.
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Greyin exists because senior talent keeps getting filtered out by keyword-matching software,
          pushed out by restructuring, or made redundant — not because they stopped being good at the
          work. Hire, write, freelance, build, connect with peers, and get seen for roles that don't
          exist yet — one login, one Greyin Score earned through real work across all six.
        </p>
      </section>

      {/* One-click demo access -- signs a visitor straight into a real,
          populated account (no signup, no password) so a pitch reviewer
          or first-time visitor can explore immediately. See
          lib/demo-personas.ts and api/demo-login/route.ts. */}
      <section id="demo" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30 p-6 sm:p-8">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">
            Try it now
          </p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-5">Explore as a demo user</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DEMO_PERSONAS.map((persona) => (
              <a
                key={persona.key}
                href={`/api/demo-login?persona=${persona.key}`}
                className="block rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition"
              >
                <div className="font-semibold text-gray-900 dark:text-gray-50">{persona.label}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{persona.tagline}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* The six pillars -- shown once, prominently, right after the
          hero. Used to be a scroll-snap carousel up here plus a second,
          plainer list further down the page -- same pillars twice was
          redundant and neither presentation gave each pillar much room.
          One rich grid instead, each card carrying a live count so it
          reads as an active platform, not a directory listing. Two even
          rows of three since Longlist (2026-08-31) filled out row 2. */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-3">Six platforms, one identity</p>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-3">Sign in once, standing everywhere</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your track record on any platform below feeds a single Greyin Score — Verified Expert status
            earned through real work, not just years on paper.
          </p>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {ROW_1_KEYS.map((key) => (
              <PillarCard key={key} pillar={PILLARS.find((p) => p.key === key)!} stat={stats[key]} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {ROW_2_KEYS.map((key) => (
              <PillarCard key={key} pillar={PILLARS.find((p) => p.key === key)!} stat={stats[key]} />
            ))}
          </div>
        </div>
      </section>

      {/* Two cross-pillar tracks */}
      <section className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-3">Not everyone's path is a straight line</p>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Cross-pillar tracks</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/pivoting" className="block bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 rounded-2xl p-8 hover:shadow-md dark:hover:shadow-none dark:hover:border-orange-700 transition-shadow">
              <Shuffle className="h-8 w-8 text-orange-600 dark:text-orange-400 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Pivoting</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Career changers get matched to employers explicitly open to it, a place to build a track record in the new domain, and mentors who've made a similar jump.</p>
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-400 inline-flex items-center gap-1 mt-4">Learn more <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
            <Link href="/reentry" className="block bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl p-8 hover:shadow-md dark:hover:shadow-none dark:hover:border-blue-700 transition-shadow">
              <RotateCcw className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Returning to work</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">A gap in your timeline — caregiving, health, layoff, sabbatical — shouldn't cost you a real hiring conversation. Tag it, and employers see the context up front.</p>
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 mt-4">Learn more <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA -- distinct content for an already-signed-in visitor, not
          just a hidden button: "Ready to get started? / Sign In" makes no
          sense to show someone who's already in. */}
      <section className="bg-indigo-600 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {user ? (
            <>
              <h2 className="text-4xl font-bold text-white mb-6">Welcome back.</h2>
              <p className="text-xl text-indigo-100 mb-10">Your ecosystem dashboard is one click away.</p>
              <Link
                href="/dashboard"
                className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-gray-800"
              >
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-bold text-white mb-6">Ready to get started?</h2>
              <p className="text-xl text-indigo-100 mb-10">One account gets you into all six platforms.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="https://deepedge.greyin.net/signup"
                  className="bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-gray-800"
                >
                  Create Your Account
                </a>
                <Link
                  href="/login"
                  className="bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-800 transition border-2 border-white"
                >
                  Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

    </main>
  )
}

function PillarCard({ pillar, stat }: { pillar: (typeof PILLARS)[number]; stat: string }) {
  const Icon = PILLAR_ICONS[pillar.key]
  return (
    <a
      href={pillar.url}
      className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-2xl border-2 p-7 hover:shadow-xl dark:hover:shadow-none hover:-translate-y-1 transition-all duration-200"
      style={{ borderColor: `${pillar.color}2a` }}
    >
      <div
        className="w-14 h-14 rounded-xl mb-5 flex items-center justify-center group-hover:scale-105 transition-transform"
        style={{ backgroundColor: `${pillar.color}1a` }}
      >
        <Icon className="h-7 w-7" style={{ color: pillar.color }} />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-1.5">{pillar.label}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-5 flex-1">{pillar.description}</p>
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${pillar.color}14`, color: pillar.color }}
        >
          {stat}
        </span>
        <ArrowRight
          className="h-5 w-5 text-gray-300 group-hover:translate-x-1 transition-transform"
          style={{ color: pillar.color }}
        />
      </div>
    </a>
  )
}
