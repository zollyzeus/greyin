import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { Search, Users2, LifeBuoy, CheckCircle } from 'lucide-react'

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-3">For Enterprises</p>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Three ways to work with DeepEdge</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            All three exist for the same reason: senior professionals keep getting
            filtered out by ATS keyword-matching, restructuring, and age bias — not because they stopped
            being good at the work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 flex flex-col">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Age-Blind Candidate Search</h2>
            <p className="text-gray-600 mb-6 flex-1">
              Self-serve search of the Verified Expert pool — every candidate has senior-level experience or
              an earned Greyin Score, not a self-reported resume.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-gray-700">
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" /> Self-serve subscription, live in minutes</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" /> Filter by skill, browse freely</li>
            </ul>
            <Link href="/pricing" className="text-center bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700">
              See pricing
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 flex flex-col">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
              <Users2 className="h-6 w-6 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Fractional Leadership Placement</h2>
            <p className="text-gray-600 mb-6 flex-1">
              Need a CTO, VP Engineering, or Head of Product a few days a week, not full-time? We match you
              with a Verified Expert for a fractional leadership engagement.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-gray-700">
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" /> Sales-led, custom terms per engagement</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" /> Invoiced, not self-serve checkout</li>
            </ul>
            <Link href="/enterprise-contact?service=fractional_leadership" className="text-center border-2 border-teal-600 text-teal-700 px-6 py-3 rounded-lg font-semibold hover:bg-teal-50">
              Talk to sales
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 flex flex-col">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
              <LifeBuoy className="h-6 w-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Outplacement</h2>
            <p className="text-gray-600 mb-6 flex-1">
              Supporting people through a layoff or restructuring is part of doing right by them. We run
              outplacement packages that connect departing employees straight into the Verified Expert
              ecosystem instead of a generic resume workshop.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-gray-700">
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" /> Sales-led, packages built around headcount</li>
              <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" /> Invoiced, not self-serve checkout</li>
            </ul>
            <Link href="/enterprise-contact?service=outplacement" className="text-center border-2 border-orange-600 text-orange-700 px-6 py-3 rounded-lg font-semibold hover:bg-orange-50">
              Talk to sales
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
