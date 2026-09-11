import { SiteHeader } from '@/components/SiteHeader'
import { Mail } from 'lucide-react'

// Real "Contact us" for sales/business/partnership inquiries -- fixes a
// bug found by a UI/UX audit (2026-09-11) where every app's footer
// "Contact" link actually opened the login-gated /feedback form.
// Deliberately anonymous (no login required, unlike /feedback's own
// deliberate login gate) since a prospective customer or partner has
// no Greyin account. Distinct from DeepEdge's /enterprise-contact
// (that one is a richer, login-gated B2B lead form for existing
// customers requesting Enterprise/Fractional/Outplacement service --
// left untouched, this is the general anonymous inbox for everyone else.
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string; success?: string; error?: string }>
}) {
  const { app, success, error } = await searchParams

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl opacity-90">Sales, partnerships, press, or anything else business-related.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {success && (
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            Thanks for reaching out — we&rsquo;ll get back to you soon.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}

        {!success && (
          <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 dark:text-gray-50">
              <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Send us a message
            </h2>
            <form action="/api/contact/create" method="POST" className="space-y-4">
              {app && <input type="hidden" name="source_app" value={app} />}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Your name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Company (optional)</label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  placeholder="What would you like to talk to us about?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm">
                Send message
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-4 dark:text-gray-500">
              Reporting a bug or have product feedback instead? Use the <a href={`https://greyin.net/feedback${app ? `?app=${app}` : ''}`} className="text-indigo-600 hover:underline dark:text-indigo-400">Feedback</a> link instead.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
