import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { ShieldCheck, Users2, Rss, Briefcase, Telescope } from 'lucide-react'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-3 dark:text-indigo-400">About</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-6 dark:text-gray-50">Senior-level experience is the baseline, not the exception</h1>
        <p className="text-lg text-gray-600 mb-6 dark:text-gray-400">
          Greyin exists because senior talent keeps getting filtered out by keyword-matching ATS software,
          pushed out by restructuring, or made redundant — not because they stopped being good at the work.
          This app, DeepEdge, is the hiring side of that: an age-blind platform where every searchable
          candidate has cleared a Verified Expert bar, not a self-reported resume.
        </p>
        <p className="text-lg text-gray-600 mb-10 dark:text-gray-400">
          DeepEdge is one of six pillars in the wider Greyin ecosystem, sharing one Verified Expert
          standard and one Greyin Score across all of them:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
            <ShieldCheck className="h-6 w-6 text-indigo-600 mb-3 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">StackWorks</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Real projects with verified, reviewed outcomes.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
            <Briefcase className="h-6 w-6 text-indigo-600 mb-3 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">FlexPro</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">A freelance marketplace with a real track record of delivery.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
            <Users2 className="h-6 w-6 text-indigo-600 mb-3 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">Salt &amp; Pepper</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">A community for senior professionals to trade real experience.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
            <Rss className="h-6 w-6 text-indigo-600 mb-3 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">GreyMatters</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Writing from senior professionals, for senior professionals.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 dark:bg-gray-900 dark:border-gray-800">
            <Telescope className="h-6 w-6 text-indigo-600 mb-3 dark:text-indigo-400" />
            <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">Longlist</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Future roles, posted anonymously, 3&ndash;12 months out.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link href="/solutions" className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
            See how it works
          </Link>
          <Link href="/enterprise-contact" className="border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40">
            Talk to us
          </Link>
        </div>
      </div>
    </main>
  )
}
