import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft, CheckCircle, MessageCircle } from 'lucide-react'

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-gray-100 text-gray-700',
  reviewing: 'bg-blue-100 text-blue-700',
  shortlisted: 'bg-indigo-100 text-indigo-700',
  interview: 'bg-purple-100 text-purple-700',
  offer: 'bg-green-100 text-green-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
}

// A candidate can withdraw from any status they'd actually still want
// to back out of -- not from a status that's already final one way or
// another (accepted/rejected already resolved the application;
// withdrawn already is one).
const WITHDRAWABLE_STATUSES = new Set(['submitted', 'reviewing', 'shortlisted', 'interview', 'offer'])

export default async function MyApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard/applications')
  }

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: applications } = candidate
    ? await supabase
        .from('applications')
        .select('id, status, applied_at, expected_salary, jobs ( id, title, location, companies ( name, user_id ) )')
        .eq('candidate_id', candidate.id)
        .order('applied_at', { ascending: false })
    : { data: [] }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="text-2xl font-bold text-blue-600">DeepEdge</a>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Applications</h1>

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            Application submitted successfully!
          </div>
        )}

        {applications && applications.length > 0 ? (
          <div className="space-y-4">
            {applications.map((app: any) => (
              <div key={app.id} className="bg-white rounded-lg shadow p-6 flex items-start justify-between">
                <div>
                  {app.jobs?.id ? (
                    <Link href={`/jobs/${app.jobs.id}`} className="font-semibold text-gray-900 hover:text-blue-600">
                      {app.jobs.title}
                    </Link>
                  ) : (
                    <p className="font-semibold text-gray-900">{app.jobs?.title}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    {app.jobs?.companies?.name} • {app.jobs?.location || 'Remote'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Applied {new Date(app.applied_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[app.status] || 'bg-gray-100 text-gray-700'}`}>
                    {app.status}
                  </span>
                  {app.jobs?.companies?.user_id && (
                    <form action="/api/messages/start" method="POST">
                      <input type="hidden" name="other_user_id" value={app.jobs.companies.user_id} />
                      <button type="submit" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                        <MessageCircle className="h-3 w-3" />
                        Message
                      </button>
                    </form>
                  )}
                  {WITHDRAWABLE_STATUSES.has(app.status) && (
                    <form action={`/api/applications/${app.id}/withdraw`} method="POST">
                      <button type="submit" className="text-xs text-gray-500 hover:text-red-600">
                        Withdraw
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No applications yet</h3>
            <p className="text-sm text-gray-500 mb-4">Start applying to jobs to track them here</p>
            <Link
              href="/jobs"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Browse Jobs
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
