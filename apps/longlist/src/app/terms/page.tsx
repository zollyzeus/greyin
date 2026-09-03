import Link from 'next/link'
import { Telescope, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Telescope className="h-8 w-8 text-amber-700" />
              <span className="ml-2 text-2xl font-bold">Longlist</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="flex items-center text-gray-600 hover:text-amber-700 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Using Longlist</h2>
            <p>
              Companies post roles they expect to open 3&ndash;12 months out. Members browse those roles with
              the company&rsquo;s identity withheld, and may subscribe as future-interested in one. You need an
              account to post a role or subscribe, and you&rsquo;re responsible for keeping your login secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">What subscribing does</h2>
            <p>
              Subscribing to a role tells that role&rsquo;s poster you&rsquo;re future-interested — your profile
              becomes visible to them for that role, the same way it already is elsewhere on Greyin. It is not
              an application, and it creates no obligation on either side. A company may also be shown
              candidates it never explicitly reached, based on skills and future interests stated on a
              member&rsquo;s profile.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Posting a role</h2>
            <p>
              A future role must be described without naming your company, team, or anything else that would
              identify it to a browsing member. Posted roles remain yours to close or mark filled at any time.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">No warranty</h2>
            <p>The platform is provided as-is; we don't guarantee any particular scoring or hiring outcome.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Questions</h2>
            <p>Reach out to <a href="mailto:admin@greyin.net" className="text-amber-700 hover:underline">admin@greyin.net</a> with any questions about these terms.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
