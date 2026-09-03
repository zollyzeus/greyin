import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, User, PlusCircle } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'

export default async function ClientJobsPage() {
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from('client_jobs')
    .select('id, title, description, budget_amount, currency, created_at, client:profiles!client_id(full_name)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
            <p className="text-gray-600 mt-1">Posted by verified experts who need something done. Applying is free.</p>
          </div>
          <Link href="/client-jobs/new" className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium">
            <PlusCircle className="h-4 w-4" />
            Post a job
          </Link>
        </div>

        {jobs && jobs.length > 0 ? (
          <div className="space-y-4">
            {jobs.map((job: any) => (
              <Link key={job.id} href={`/client-jobs/${job.id}`} className="block bg-white rounded-lg shadow-md hover:shadow-lg transition p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{job.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{job.description}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <User className="h-3.5 w-3.5" />
                      {job.client?.full_name || 'A client'}
                    </div>
                  </div>
                  {job.budget_amount && (
                    <span className="font-bold text-gray-900 flex-shrink-0 ml-4">₹{job.budget_amount.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No open jobs right now</h3>
            <p className="text-sm text-gray-500">Check back soon, or post one yourself.</p>
          </div>
        )}
      </div>
    </main>
  )
}
