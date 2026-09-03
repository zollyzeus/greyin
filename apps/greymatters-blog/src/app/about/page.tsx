import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { BookOpen, ShieldCheck, Users2, Briefcase } from 'lucide-react'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <p className="text-sm font-semibold text-sky-600 uppercase tracking-wide mb-3">About</p>
        <h1 className="text-4xl font-bold text-gray-900 mb-6">Writing from senior professionals, for senior professionals</h1>
        <p className="text-lg text-gray-600 mb-6">
          GreyMatters is the writing and reading home of the Greyin ecosystem — essays, war stories, and
          career transitions written by the people living them, not generic career-advice content. Authors
          set who can read and comment on each post, and posts feed the ecosystem's shared Greyin Score
          alongside the other four pillars.
        </p>
        <p className="text-lg text-gray-600 mb-10">
          GreyMatters is one pillar in a wider platform built on one idea: senior-level experience is the
          baseline, not the exception.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <BookOpen className="h-6 w-6 text-sky-600 mb-3" />
            <h2 className="font-semibold text-gray-900 mb-1">DeepEdge</h2>
            <p className="text-sm text-gray-600">Age-blind hiring, built for a Verified Expert pool.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <ShieldCheck className="h-6 w-6 text-sky-600 mb-3" />
            <h2 className="font-semibold text-gray-900 mb-1">StackWorks</h2>
            <p className="text-sm text-gray-600">Real projects with verified, reviewed outcomes.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <Briefcase className="h-6 w-6 text-sky-600 mb-3" />
            <h2 className="font-semibold text-gray-900 mb-1">FlexPro</h2>
            <p className="text-sm text-gray-600">A freelance marketplace with a real track record of delivery.</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <Users2 className="h-6 w-6 text-sky-600 mb-3" />
            <h2 className="font-semibold text-gray-900 mb-1">Salt &amp; Pepper</h2>
            <p className="text-sm text-gray-600">A community for senior professionals to trade real experience.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link href="/" className="bg-sky-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-sky-700">
            Read the blog
          </Link>
          <Link href="/signup" className="border-2 border-sky-600 text-sky-600 px-6 py-3 rounded-lg font-semibold hover:bg-sky-50">
            Start writing
          </Link>
        </div>
      </div>
    </main>
  )
}
