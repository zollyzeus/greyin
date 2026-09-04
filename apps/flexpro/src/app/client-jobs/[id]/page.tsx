import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, User, CheckCircle } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

export default async function ClientJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ applied?: string; error?: string }>
}) {
  const { id } = await params
  const { applied, error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: job } = await supabase
    .from('client_jobs')
    .select('id, title, description, budget_amount, status, client_id, created_at, client:profiles!client_id(full_name)')
    .eq('id', id)
    .single()

  if (!job) {
    notFound()
  }

  const isOwner = user && job.client_id === user.id

  const { data: myApplication } = user && !isOwner
    ? await supabase.from('client_job_applications').select('id, status, proposed_price').eq('job_id', id).eq('freelancer_id', user.id).maybeSingle()
    : { data: null }

  const { data: applications } = isOwner
    ? await supabase
        .from('client_job_applications')
        .select('id, cover_note, proposed_price, status, created_at, freelancer:profiles!freelancer_id(full_name)')
        .eq('job_id', id)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SiteHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/client-jobs" className="flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4" />
          Back to jobs
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 mb-6 dark:bg-gray-900">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-50">{job.title}</h1>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 dark:text-gray-400">
                <User className="h-3.5 w-3.5" />
                {(job as any).client?.full_name || 'A client'}
              </p>
            </div>
            {job.budget_amount && <span className="text-xl font-bold text-gray-900 dark:text-gray-50">₹{job.budget_amount.toLocaleString('en-IN')}</span>}
          </div>
          <p className="text-gray-700 mt-4 whitespace-pre-wrap dark:text-gray-300">{job.description}</p>
          <span className={`inline-block mt-4 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
            job.status === 'open' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {job.status.replace('_', ' ')}
          </span>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}
        {applied && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Application submitted.
          </div>
        )}

        {/* Owner view: applicants */}
        {isOwner && (
          <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">Applicants ({(applications || []).length})</h2>
            {applications && applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map((app: any) => (
                  <div key={app.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-50">{app.freelancer?.full_name || 'A freelancer'}</p>
                      {app.cover_note && <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">{app.cover_note}</p>}
                      <p className="text-sm font-semibold text-gray-900 mt-2 dark:text-gray-50">₹{app.proposed_price.toLocaleString('en-IN')}</p>
                      <span className={`inline-block mt-1 text-xs font-medium capitalize ${
                        app.status === 'pending' ? 'text-gray-500 dark:text-gray-400' : app.status === 'accepted' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                    {app.status === 'pending' && job.status === 'open' && (
                      <div className="flex gap-2 flex-shrink-0 ml-4">
                        <form action={`/api/client-jobs/${job.id}/applications/${app.id}/accept`} method="POST">
                          <button type="submit" className="text-sm font-medium bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700">
                            Accept
                          </button>
                        </form>
                        <form action={`/api/client-jobs/${job.id}/applications/${app.id}/reject`} method="POST">
                          <button type="submit" className="text-sm font-medium border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
                            Reject
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No applicants yet.</p>
            )}
          </div>
        )}

        {/* Freelancer view: apply */}
        {!isOwner && job.status === 'open' && (
          <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
            {myApplication ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                You applied with a proposed price of ₹{myApplication.proposed_price.toLocaleString('en-IN')} —
                status: <span className="font-medium capitalize">{myApplication.status}</span>
              </p>
            ) : user ? (
              <>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-50">Apply — free, no subscription needed</h2>
                <form action={`/api/client-jobs/${job.id}/apply`} method="POST" className="space-y-4">
                  <div>
                    <label htmlFor="proposed_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your proposed price (₹)</label>
                    <input id="proposed_price" name="proposed_price" type="number" min="1" required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  </div>
                  <div>
                    <label htmlFor="cover_note" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cover note (optional)</label>
                    <textarea id="cover_note" name="cover_note" rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  </div>
                  <button type="submit" className="w-full py-3 px-4 rounded-lg text-white bg-orange-600 hover:bg-orange-700 font-medium">
                    Submit application
                  </button>
                </form>
              </>
            ) : (
              <Link href={`/login?next=/client-jobs/${job.id}`} className="text-orange-600 font-medium hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">
                Sign in to apply
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
