import Link from 'next/link'
import { BookOpen, ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function TermsPage() {
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

        <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-gray-50">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8 dark:text-gray-400">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Using GreyMatters</h2>
            <p>
              GreyMatters is a writing and reading platform for the Greyin ecosystem. You need an account to
              publish posts, comment, or tip authors, and you're responsible for keeping your login secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Your writing</h2>
            <p>
              Posts and comments you publish remain yours. You control who can view and comment on each
              post via its audience settings. We can remove content or suspend accounts for spam, harassment,
              or plagiarism.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Tips</h2>
            <p>
              Readers can tip authors directly through the platform's payment provider. Tips are processed
              by that provider — we don't store your card details.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">No warranty</h2>
            <p>The platform is provided as-is; we don't guarantee uninterrupted availability.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Questions</h2>
            <p>Reach out to <a href="mailto:admin@greyin.net" className="text-sky-600 hover:underline dark:text-sky-400">admin@greyin.net</a> with any questions about these terms.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
