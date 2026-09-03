import Link from 'next/link'
import { Briefcase, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated August 2026</p>

        <div className="bg-white rounded-lg shadow-md p-8 space-y-6 text-gray-700">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Using FlexPro</h2>
            <p>
              FlexPro is a subscription-based freelance marketplace: an active subscription is required to
              list a gig or post a job, and a service fee applies to both sides of a completed transaction.
              You need an account to list gigs, post jobs, or place orders, and you're responsible for
              keeping your login secure.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Orders and payment</h2>
            <p>
              Payment for an order is held until the freelancer delivers and the buyer accepts (or an admin
              resolves a dispute). Payments are processed by our payment provider — we don't store your card
              details.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Acceptable use</h2>
            <p>
              Don't misrepresent your gig, skip the platform's order/escrow flow to avoid it, or harass
              other users. We can suspend accounts that do.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">No warranty</h2>
            <p>The platform is provided as-is; we don't guarantee any particular order outcome.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">Questions</h2>
            <p>Reach out to <a href="mailto:admin@greyin.net" className="text-blue-600 hover:underline">admin@greyin.net</a> with any questions about these terms.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
