import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, BellPlus, CheckCircle } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function JobAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const { success } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard/alerts')
  }

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  const { data: alerts } = await supabase
    .from('job_alerts')
    .select('id, keywords, location, created_at')
    .order('created_at', { ascending: false })

  return (
    <WorkspaceShell
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
      pageTitle="Job Alerts"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center gap-2 mb-6">
          <BellPlus className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Job Alerts</h1>
        </div>

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Alert saved — we'll notify you when a matching job is posted.
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md divide-y dark:bg-gray-900">
          {alerts && alerts.length > 0 ? (
            alerts.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    {[a.keywords, a.location].filter(Boolean).join(' · ') || 'All new jobs'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">
                    Created {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <form action={`/api/job-alerts/${a.id}/delete`} method="POST">
                  <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                    Delete
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="p-6 text-gray-500 text-sm dark:text-gray-400">
              No alerts yet — search for jobs and save your search to get notified.
            </p>
          )}
        </div>
      </div>
    </WorkspaceShell>
  )
}
