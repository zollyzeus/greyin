import Link from 'next/link'
import { Briefcase, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Using DeepEdge</h2>
            <p>
              DeepEdge connects employers with experienced professionals. You need an account to
              post or apply to jobs, and you're responsible for keeping the information on it accurate and
              your login credentials secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Acceptable use</h2>
            <p>
              Don't scrape, spam, misrepresent your identity or experience, or use the platform to harass
              other users. We can suspend or remove accounts that do.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Your content</h2>
            <p>
              Job postings, applications, and profile information you submit remain yours. You give us
              permission to display them to other users as the platform's normal functioning requires — for
              example, showing your application to the employer you applied to.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">No warranty</h2>
            <p>
              The platform is provided as-is. We work to keep listings and Verified Expert scoring accurate,
              but we don't guarantee any hiring or application outcome.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Questions</h2>
            <p>
              Reach out via <Link href="/enterprise-contact" className="text-indigo-600 hover:underline">our contact form</Link> with
              any questions about these terms.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
