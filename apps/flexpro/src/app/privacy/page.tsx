import Link from 'next/link'
import { Briefcase, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-2xl font-bold">FlexPro</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="flex items-center text-gray-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">What we collect</h2>
            <p>
              Account details you give us at signup, your gig listings and order history, and basic usage
              data needed to run the platform and keep it secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">How we use it</h2>
            <p>
              To operate the platform — matching buyers and sellers, processing orders and payouts, and
              notifying you about order status changes. We don't sell your data to third parties.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Payments</h2>
            <p>
              Payment details are handled entirely by our payment provider — we never see or store your
              card or bank details directly.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Cookies</h2>
            <p>We use cookies to keep you signed in and remember your session — nothing beyond that.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Your data, your control</h2>
            <p>
              You can update your profile at any time. For anything else, reach out to
              {' '}<a href="mailto:admin@greyin.net" className="text-blue-600 hover:underline">admin@greyin.net</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
