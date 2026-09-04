import Link from 'next/link'
import { Users, ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <span className="ml-2 text-2xl font-bold">Salt & Pepper</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="flex items-center text-gray-600 hover:text-purple-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2 dark:text-gray-50">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8 dark:text-gray-400">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Using Salt &amp; Pepper</h2>
            <p>
              Salt &amp; Pepper is a community for senior professionals to trade real experience. You need
              an account to post, reply, or message other members, and you're responsible for keeping your
              login secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Community conduct</h2>
            <p>
              Be respectful of other members. Anonymous posting exists for genuinely sensitive topics, not
              as cover for harassment — we can remove content or suspend accounts that abuse it.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Your content</h2>
            <p>
              Discussions and replies you post remain yours. Anonymous posts stay attributed to your account
              for moderation purposes even though other members see &ldquo;Anonymous Member.&rdquo;
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">No warranty</h2>
            <p>The platform is provided as-is; we don't guarantee uninterrupted availability.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2 dark:text-gray-50">Questions</h2>
            <p>Reach out to <a href="mailto:admin@greyin.net" className="text-purple-600 hover:underline dark:text-purple-400">admin@greyin.net</a> with any questions about these terms.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
