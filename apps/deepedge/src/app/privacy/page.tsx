import Link from 'next/link'
import { Briefcase, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">What we collect</h2>
            <p>
              Account details you give us at signup (name, email, experience), profile and job-posting
              content you add, and basic usage data (like sign-in activity) needed to run the platform and
              keep it secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">How we use it</h2>
            <p>
              To operate the platform — matching candidates to jobs, sending you notifications about your
              applications or postings, and calculating Verified Expert / Greyin Score status. We don't sell
              your data to third parties.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">What other users see</h2>
            <p>
              Your profile and job activity are visible to other users the way the platform's normal
              features require — for example, an employer sees your application when you apply to their
              job. You control what's on your public profile.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Cookies</h2>
            <p>We use cookies to keep you signed in and remember your session — nothing beyond that.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Your data, your control</h2>
            <p>
              You can update or delete your profile information at any time from your account settings.
              For anything else, reach out via <Link href="/enterprise-contact" className="text-indigo-600 hover:underline">our contact form</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
