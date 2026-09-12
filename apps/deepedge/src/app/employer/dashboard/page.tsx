import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Briefcase, Building2, TrendingUp, FileText, PlusCircle } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function EmployerDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/employer/dashboard')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employer') {
    redirect('/dashboard')
  }

  // Two-sided proactive matchmaking, employer side (Phase D3, 134) --
  // same lazy, page-load-triggered sweep shape as sweep_salary_trend_alerts()
  // (063), just scoped to this employer's own open jobs.
  await supabase.rpc('sweep_proactive_candidate_matches_for_employer')

  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  // Get company data
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Get jobs posted
  const { data: jobs, count: jobsCount } = await supabase
    .from('jobs')
    .select('*, applications(count)', { count: 'exact' })
    .eq('company_id', company?.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Get total applications
  const { count: totalApplications } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .in('job_id', jobs?.map(j => j.id) || [])

  return (
    <WorkspaceShell
      variant="employer"
      activeSection="employer-dashboard"
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle="Dashboard"
    >

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
            {company?.name || 'Your Company'}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manage your job postings and applications</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{jobsCount || 0}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg dark:bg-indigo-950/40">
                <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Applications</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{totalApplications || 0}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg dark:bg-green-950/40">
                <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Profile Views</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">0</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg dark:bg-blue-950/40">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Company Page</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                  {company ? '✓' : '○'}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg dark:bg-purple-950/40">
                <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="bg-white rounded-lg shadow dark:bg-gray-900">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Active Job Postings</h2>
            <Link
              href="/employer/post-job"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Post New Job</span>
            </Link>
          </div>
          <div className="p-6">
            {jobs && jobs.length > 0 ? (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors dark:border-gray-800 dark:hover:border-indigo-700">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-50">{job.title}</h3>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                          job.status === 'open' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                            : job.status === 'closed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            : job.status === 'filled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">{job.location} • {job.employment_type}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {job.applications?.[0]?.count || 0} applications
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Posted {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        <Link
                          href={`/employer/jobs/${job.id}/applications`}
                          className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          View Applications
                        </Link>
                        <Link
                          href={`/employer/jobs/${job.id}/edit`}
                          className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                          Edit
                        </Link>
                        {job.status === 'open' && (
                          <form action={`/api/jobs/${job.id}/status`} method="POST">
                            <input type="hidden" name="status" value="closed" />
                            <button type="submit" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                              Close listing
                            </button>
                          </form>
                        )}
                        {job.status === 'closed' && (
                          <form action={`/api/jobs/${job.id}/status`} method="POST">
                            <input type="hidden" name="status" value="open" />
                            <button type="submit" className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                              Reopen
                            </button>
                          </form>
                        )}
                      </div>
                      <form action={`/api/jobs/${job.id}/feed-visibility`} method="POST" className="flex items-center gap-2">
                        <select
                          name="feed_visibility"
                          defaultValue={job.feed_visibility}
                          className="text-xs border border-gray-300 rounded-lg px-2 py-1 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        >
                          <option value="public">Public</option>
                          <option value="followers">Followers only</option>
                          <option value="private">Don&rsquo;t include</option>
                        </select>
                        <button type="submit" className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                          Save
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4 dark:text-gray-500" />
                <h3 className="text-sm font-medium text-gray-900 mb-1 dark:text-gray-50">No active jobs</h3>
                <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">Start hiring by posting your first job</p>
                <Link
                  href="/employer/post-job"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Post Your First Job
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </WorkspaceShell>
  )
}
