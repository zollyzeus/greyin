import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Briefcase, CheckCircle, MessageCircle } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { InterviewPrepAssist } from '@/components/InterviewPrepAssist'

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  reviewing: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  shortlisted: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
  interview: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  offer: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  withdrawn: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
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

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

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
    <WorkspaceShell
      activeSection="applications"
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="My Applications"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-blue-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-6 dark:text-gray-50">My Applications</h1>

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Application submitted successfully!
          </div>
        )}

        {applications && applications.length > 0 ? (
          <div className="space-y-4">
            {applications.map((app: any) => (
              <div key={app.id} className="bg-white rounded-lg shadow p-6 flex flex-wrap items-start justify-between dark:bg-gray-900">
                <div>
                  {app.jobs?.id ? (
                    <Link href={`/jobs/${app.jobs.id}`} className="font-semibold text-gray-900 hover:text-blue-600 dark:text-gray-50">
                      {app.jobs.title}
                    </Link>
                  ) : (
                    <p className="font-semibold text-gray-900 dark:text-gray-50">{app.jobs?.title}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
                    {app.jobs?.companies?.name} • {app.jobs?.location || 'Remote'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 dark:text-gray-500">
                    Applied {new Date(app.applied_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[app.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                    {app.status}
                  </span>
                  {app.jobs?.companies?.user_id && (
                    <form action="/api/messages/start" method="POST">
                      <input type="hidden" name="other_user_id" value={app.jobs.companies.user_id} />
                      <button type="submit" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        <MessageCircle className="h-3 w-3" />
                        Message
                      </button>
                    </form>
                  )}
                  {WITHDRAWABLE_STATUSES.has(app.status) && (
                    <form action={`/api/applications/${app.id}/withdraw`} method="POST">
                      <button type="submit" className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400">
                        Withdraw
                      </button>
                    </form>
                  )}
                </div>
                {app.status === 'interview' && (
                  <div className="w-full basis-full">
                    <InterviewPrepAssist applicationId={app.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center dark:bg-gray-900">
            <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4 dark:text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900 mb-1 dark:text-gray-50">No applications yet</h3>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">Start applying to jobs to track them here</p>
            <Link
              href="/jobs"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Browse Jobs
            </Link>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
