import Link from 'next/link'
import { BookOpen, ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <BookOpen className="h-8 w-8 text-sky-600 dark:text-sky-400" />
              <span className="ml-2 text-2xl font-bold">GreyMatters</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="flex items-center text-gray-600 hover:text-sky-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-gray-50">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8 dark:text-gray-400">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">What we collect</h2>
            <p>
              Account details you give us at signup, the posts/comments you publish, and basic usage data
              needed to run the platform and keep it secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">How we use it</h2>
            <p>
              To operate the platform — publishing your posts, notifying you about comments and tips, and
              sending the weekly digest if you've subscribed. We don't sell your data to third parties.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">What other readers see</h2>
            <p>
              Published posts are visible per the audience setting you chose. Your email address is private
              unless you choose to show it on your public profile.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Cookies</h2>
            <p>We use cookies to keep you signed in and remember your session — nothing beyond that.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Your data, your control</h2>
            <p>
              You can update your profile, unsubscribe from the digest, or delete a post at any time. For
              anything else, reach out to <a href="mailto:admin@greyin.net" className="text-sky-600 hover:underline dark:text-sky-400">admin@greyin.net</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
