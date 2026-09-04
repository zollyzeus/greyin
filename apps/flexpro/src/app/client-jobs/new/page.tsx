import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewClientJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/client-jobs/new')
  }

  const { data: subscription } = await supabase
    .from('flexpro_subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/client-jobs" className="flex items-center gap-2 text-gray-600 hover:text-orange-600 dark:text-gray-400">
              <ArrowLeft className="h-4 w-4" />
              Back to jobs
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-50">Post a job</h1>
          <p className="text-gray-600 mb-6 dark:text-gray-400">Describe what you need done. Verified experts apply, you pick who does the work.</p>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
              {decodeURIComponent(error)}
            </div>
          )}

          {subscription?.status !== 'active' ? (
            <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 dark:bg-orange-950/40 dark:border-orange-900 dark:text-orange-400">
              Posting a job requires an active FlexPro Pro subscription.{' '}
              <Link href="/subscribe" className="font-semibold underline">Subscribe</Link> to continue.
            </div>
          ) : (
            <form action="/api/client-jobs/create" method="POST" className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job title</label>
                <input id="title" name="title" type="text" required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="I need a real-time dashboard built" />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea id="description" name="description" required rows={5}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="What needs doing, scope, timeline..." />
              </div>
              <div>
                <label htmlFor="budget_amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Budget (₹, optional)</label>
                <input id="budget_amount" name="budget_amount" type="number" min="0"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="10000" />
              </div>
              <button type="submit" className="w-full flex justify-center py-3 px-4 rounded-lg text-white bg-orange-600 hover:bg-orange-700 font-medium">
                Post job
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
