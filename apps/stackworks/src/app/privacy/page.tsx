import Link from 'next/link'
import { FlaskConical, ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <FlaskConical className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              <span className="ml-2 text-2xl font-bold">StackWorks</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="flex items-center text-gray-600 hover:text-teal-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-gray-50">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8 dark:text-gray-400">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">What we collect</h2>
            <p>
              Account details you give us at signup, your projects/asks/updates, and basic usage data
              needed to run the platform and keep it secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">How we use it</h2>
            <p>
              To operate the platform — matching Supporters to open asks, scoring submitted outcomes, and
              notifying you about application/ask activity. We don't sell your data to third parties.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">AI scoring</h2>
            <p>
              Submitted outcomes may be evaluated by an AI provider to generate a quality score. Only the
              outcome content itself is sent for scoring, not your account credentials.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Cookies</h2>
            <p>We use cookies to keep you signed in and remember your session — nothing beyond that.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Your data, your control</h2>
            <p>
              You can update your profile at any time. For anything else, reach out to
              {' '}<a href="mailto:admin@greyin.net" className="text-teal-600 hover:underline dark:text-teal-400">admin@greyin.net</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
