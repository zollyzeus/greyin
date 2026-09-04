import Link from 'next/link'
import { Briefcase, Users, Building2, TrendingUp, CheckCircle, ArrowRight, Search, Users2, LifeBuoy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { SiteHeader } from '@/components/SiteHeader'
import { PILLARS } from '@/components/EcosystemWidget'

const OTHER_PILLARS = PILLARS.filter((p) => p.key !== 'deepedge')

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Real counts, not the placeholder "10,000+" copy that used to sit
  // here regardless of actual data -- next to a jobs page that can
  // (and did) show zero, that gap was the fastest way to lose a
  // skeptical visitor's trust.
  //
  // candidates specifically uses the service-role client, not the
  // anon-scoped one jobs/companies use above -- its own SELECT RLS
  // requires auth.role()='authenticated' with no public branch, so an
  // anonymous visitor's own query silently returned 0 regardless of real
  // row count (found while verifying these counts actually reflect real
  // data, for every logged-out visitor this homepage exists to impress,
  // not something specific to today's seed).
  const service = createServiceClient()
  const [{ count: jobCount }, { count: companyCount }, { count: candidateCount }] = await Promise.all([
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    service.from('candidates').select('id', { count: 'exact', head: true }),
  ])

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
      <SiteHeader />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <p className="inline-block text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-4 bg-indigo-50 dark:bg-indigo-950 rounded-full px-4 py-1.5">
            Built for senior professionals
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-semibold text-gray-900 dark:text-gray-50 mb-6">
            Hire the people ATS bots
            <span className="text-indigo-600 dark:text-indigo-400"> auto-reject</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-3xl mx-auto">
            Greyin exists because senior talent keeps getting filtered out by keyword-matching software,
            pushed out by restructuring, or made redundant — not because they stopped being good at the
            work. We built an age-blind hiring platform where senior-level experience is the baseline,
            not a liability, and where employers pay for access to a verified expert pool instead of
            gambling on a resume.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup?type=employer"
              className="bg-indigo-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-700 transition flex items-center justify-center"
            >
              <Briefcase className="mr-2 h-5 w-5" />
              Post a Job
            </Link>
            <Link
              href="/signup?type=candidate"
              className="bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-600 dark:border-indigo-500 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 transition flex items-center justify-center dark:hover:bg-indigo-950/40"
            >
              <Users className="mr-2 h-5 w-5" />
              Find Jobs
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">{jobCount ?? 0}</div>
            <div className="text-gray-600 dark:text-gray-400">Open Jobs</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">{companyCount ?? 0}</div>
            <div className="text-gray-600 dark:text-gray-400">Companies</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md dark:shadow-none dark:border dark:border-gray-800 p-8 text-center">
            <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">{candidateCount ?? 0}</div>
            <div className="text-gray-600 dark:text-gray-400">Candidates</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white dark:bg-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-gray-50 mb-16">Why Choose DeepEdge?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6">
              <div className="bg-indigo-100 dark:bg-indigo-950 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Smart Matching</h3>
              <p className="text-gray-600 dark:text-gray-400">Our AI-powered algorithm matches candidates with the perfect job opportunities based on skills, experience, and preferences.</p>
            </div>
            <div className="p-6">
              <div className="bg-indigo-100 dark:bg-indigo-950 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Verified Companies</h3>
              <p className="text-gray-600 dark:text-gray-400">All companies on our platform are verified to ensure authenticity and provide a secure hiring experience.</p>
            </div>
            <div className="p-6">
              <div className="bg-indigo-100 dark:bg-indigo-950 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">A Verified Expert Pool</h3>
              <p className="text-gray-600 dark:text-gray-400">Every searchable candidate has cleared the Verified Expert bar — senior-level experience, or a real track record on StackWorks, FlexPro, or Salt &amp; Pepper — not a self-reported resume.</p>
            </div>
            <div className="p-6">
              <div className="bg-indigo-100 dark:bg-indigo-950 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Briefcase className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Easy Job Posting</h3>
              <p className="text-gray-600 dark:text-gray-400">Create and publish job listings in minutes with our intuitive interface and comprehensive templates.</p>
            </div>
            <div className="p-6">
              <div className="bg-indigo-100 dark:bg-indigo-950 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <ArrowRight className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Fast Applications</h3>
              <p className="text-gray-600 dark:text-gray-400">Streamlined application process allows candidates to apply to multiple positions quickly and efficiently.</p>
            </div>
            <div className="p-6">
              <div className="bg-indigo-100 dark:bg-indigo-950 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">Company Profiles</h3>
              <p className="text-gray-600 dark:text-gray-400">Showcase your company culture, values, and benefits with rich, engaging company profiles.</p>
            </div>
          </div>
        </div>
      </section>

      {/* For Enterprises: the three offerings the original plan named */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-3">For Enterprises</p>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-50 mb-4">Three ways to work with DeepEdge</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Link href="/solutions" className="block bg-gray-50 dark:bg-gray-950 rounded-2xl p-8 hover:shadow-md dark:hover:shadow-none dark:border dark:border-gray-800 dark:hover:border-gray-700 transition-shadow">
              <Search className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Age-Blind Candidate Search</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Self-serve subscription access to the Verified Expert pool.</p>
            </Link>
            <Link href="/solutions" className="block bg-gray-50 dark:bg-gray-950 rounded-2xl p-8 hover:shadow-md dark:hover:shadow-none dark:border dark:border-gray-800 dark:hover:border-gray-700 transition-shadow">
              <Users2 className="h-8 w-8 text-teal-600 dark:text-teal-400 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Fractional Leadership Placement</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">A Verified Expert leader, a few days a week, sales-led.</p>
            </Link>
            <Link href="/solutions" className="block bg-gray-50 dark:bg-gray-950 rounded-2xl p-8 hover:shadow-md dark:hover:shadow-none dark:border dark:border-gray-800 dark:hover:border-gray-700 transition-shadow">
              <LifeBuoy className="h-8 w-8 text-orange-600 dark:text-orange-400 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-2">Outplacement</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Support departing employees straight into the ecosystem.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Structural sync pass (2026-09-05): this used to be a one-line
          text mention ("Ecosystem discovery lives on the hub") instead of
          the card-grid section every other pillar homepage has -- and had
          silently gone stale, never updated to include Longlist. Switched
          to the same OTHER_PILLARS card pattern so a future new pillar
          can't be missed here again. */}
      <div className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-2">Part of the Greyin ecosystem</p>
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

      {/* CTA Section -- distinct content for an already-signed-in
          visitor, not just a hidden button: "sign up" copy makes no
          sense to show someone who's already in. */}
      <section className="bg-indigo-600 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {user ? (
            <>
              <h2 className="text-4xl font-bold text-white mb-6">Welcome back.</h2>
              <p className="text-xl text-indigo-100 mb-10">Pick up where you left off.</p>
              <Link
                href="/dashboard"
                className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-gray-800"
              >
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-4xl font-bold text-white mb-6">Ready to Get Started?</h2>
              <p className="text-xl text-indigo-100 mb-10">Join the companies and candidates already using DeepEdge.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup?type=employer"
                  className="bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition dark:bg-gray-900 dark:text-indigo-400 dark:hover:bg-gray-800"
                >
                  Post Your First Job
                </Link>
                <Link
                  href="/signup?type=candidate"
                  className="bg-indigo-700 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-800 transition border-2 border-white"
                >
                  Create Your Profile
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

    </main>
  )
}
