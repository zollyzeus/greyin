import { RotateCcw, ArrowRight, User, FlaskConical, GraduationCap } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

export default function ReentryPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            <RotateCcw className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Returning to work</h1>
        </div>
        <p className="text-lg text-gray-600 mb-10">
          Support for professionals returning to work after an employment gap — caregiving, health, a
          layoff, a sabbatical. Unlike a domain switch, there&apos;s no mismatch to route around here:
          you&apos;re returning to the field you already know, so you already qualify as a Verified
          Expert on your existing years and score. This is purely additive — a badge and context shown
          wherever your profile already shows up, not a separate, narrower path. You show up in normal
          candidate search and job applications exactly as any other Verified Expert.
        </p>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow p-6 flex gap-4">
            <User className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">1. Tag it on DeepEdge</h2>
              <p className="text-gray-600 text-sm mb-3">
                Verified Experts can tag a career re-entry — a reason, and a note — on their profile.
                Employers see it right alongside your Verified Expert status when reviewing an
                application, and can flag their own job postings as &quot;open to candidates with
                career gaps&quot; as a public signal.
              </p>
              <a href="https://deepedge.greyin.net/profile" className="text-sm font-semibold text-indigo-600 inline-flex items-center gap-1">
                Set your re-entry status <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 flex gap-4">
            <FlaskConical className="h-6 w-6 text-teal-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">2. Build a fresh track record on StackWorks</h2>
              <p className="text-gray-600 text-sm mb-3">
                A recent, verified record of real work is worth more than explaining a gap on paper —
                StackWorks&apos;s Supporter track is already fully open.
              </p>
              <a href="https://stackworks.greyin.net" className="text-sm font-semibold text-teal-600 inline-flex items-center gap-1">
                Browse StackWorks asks <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 flex gap-4">
            <GraduationCap className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">3. Find a mentor on Salt &amp; Pepper</h2>
              <p className="text-gray-600 text-sm mb-3">
                Peer support from people who&apos;ve done the same comeback — mentors who&apos;ve
                returned to work themselves show a note on their mentor card.
              </p>
              <a href="https://saltnpepper.greyin.net/mentors" className="text-sm font-semibold text-purple-600 inline-flex items-center gap-1">
                Find a mentor <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center">
          <a href="https://deepedge.greyin.net/jobs" className="text-sm font-semibold text-blue-700 inline-flex items-center gap-1">
            Browse jobs open to candidates with career gaps <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </main>
  )
}
