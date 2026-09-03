import Link from 'next/link'
import { FlaskConical, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <FlaskConical className="h-8 w-8 text-teal-600" />
              <span className="ml-2 text-2xl font-bold">StackWorks</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="flex items-center text-gray-600 hover:text-teal-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Using StackWorks</h2>
            <p>
              StackWorks connects Builders shipping real projects with Supporters who help. You need an
              account to post a project, apply to an ask, or submit an outcome for verification, and you're
              responsible for keeping your login secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Verified outcomes</h2>
            <p>
              Submitted outcomes are AI-scored and, when flagged, human-reviewed. A verified outcome
              contributes to your Greyin Score — misrepresenting your involvement in a project is grounds
              for account suspension.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Your content</h2>
            <p>
              Projects, asks, and updates you post remain yours. You control who can see each update's
              contribution to your followers' feed.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">No warranty</h2>
            <p>The platform is provided as-is; we don't guarantee any particular scoring or hiring outcome.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Questions</h2>
            <p>Reach out to <a href="mailto:admin@greyin.net" className="text-teal-600 hover:underline">admin@greyin.net</a> with any questions about these terms.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
