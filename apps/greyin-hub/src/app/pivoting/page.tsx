import { Shuffle, ArrowRight, User, FlaskConical, GraduationCap } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

export default function PivotingPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center dark:bg-orange-950/40">
            <Shuffle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Pivoting</h1>
        </div>
        <p className="text-lg text-gray-600 mb-10 dark:text-gray-400">
          Support for senior professionals changing careers — out of passion or market necessity, not
          just staying in their existing lane. A pivoter isn&apos;t folded into the normal Verified
          Expert candidate pool as-is: an employer searching for &quot;senior software engineers&quot;
          shouldn&apos;t see a 15-year finance veteran with zero coding background just because their
          years of experience qualify. Instead, three platforms work together:
        </p>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6 flex gap-4 dark:bg-gray-900">
            <User className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-1 dark:text-indigo-400" />
            <div>
              <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">1. Tag it on DeepEdge</h2>
              <p className="text-gray-600 text-sm mb-3 dark:text-gray-400">
                Verified Experts can tag themselves as pivoting — from domain, to domain, and a note —
                on their profile. Employers can then opt individual job postings into &quot;open to
                career changers,&quot; and only pivoter-tagged candidates can apply to those roles
                without also matching the domain on paper.
              </p>
              <a href="https://deepedge.greyin.net/profile" className="text-sm font-semibold text-indigo-600 inline-flex items-center gap-1 dark:text-indigo-400">
                Set your pivot status <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 flex gap-4 dark:bg-gray-900">
            <FlaskConical className="h-6 w-6 text-teal-600 flex-shrink-0 mt-1 dark:text-teal-400" />
            <div>
              <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">2. Build a track record on StackWorks</h2>
              <p className="text-gray-600 text-sm mb-3 dark:text-gray-400">
                StackWorks&apos;s Supporter track is already fully open — the place to build a real,
                verified record in the new domain, reviewed by senior Builders.
              </p>
              <a href="https://stackworks.greyin.net" className="text-sm font-semibold text-teal-600 inline-flex items-center gap-1 dark:text-teal-400">
                Browse StackWorks asks <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 flex gap-4 dark:bg-gray-900">
            <GraduationCap className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1 dark:text-purple-400" />
            <div>
              <h2 className="font-semibold text-gray-900 mb-1 dark:text-gray-50">3. Find a mentor on Salt &amp; Pepper</h2>
              <p className="text-gray-600 text-sm mb-3 dark:text-gray-400">
                Peer mentor-matching from people who&apos;ve already made a similar jump — or lifelong
                domain experts happy to talk to someone entering their field.
              </p>
              <a href="https://saltnpepper.greyin.net/mentors" className="text-sm font-semibold text-purple-600 inline-flex items-center gap-1 dark:text-purple-400">
                Find a mentor <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <a href="https://deepedge.greyin.net/jobs" className="text-sm font-semibold text-orange-700 inline-flex items-center gap-1 dark:text-orange-400">
            Browse jobs open to career changers <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </main>
  )
}
