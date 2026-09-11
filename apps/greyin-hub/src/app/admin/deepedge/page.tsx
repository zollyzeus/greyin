import { createClient } from '@/lib/supabase/server'
import { Briefcase, ExternalLink } from 'lucide-react'

// Ported from apps/deepedge/src/app/admin/page.tsx (Phase 3, pitch-
// readiness plan) -- same queries/RLS, posting to Hub's own copy of the
// two API routes it uses (api/admin/deepedge/jobs/close,
// api/admin/deepedge/users/update-role). The original DeepEdge-hosted
// page stays live, unmodified -- this is an additive consolidation, not
// a replacement. Deeper/less-frequent tools (Enterprise Subscriptions,
// hiring-tier pricing) aren't duplicated here -- linked out to their
// existing DeepEdge-hosted pages instead, since duplicating those too
// would double a lot of surface for comparatively rare admin actions.
export default async function DeepEdgeAdminPage() {
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, status, companies ( name )')
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">DeepEdge</h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <a href="https://deepedge.greyin.net/admin/subscriptions" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            Enterprise Subscriptions <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a href="https://deepedge.greyin.net/admin/subscription-tiers" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            Hiring Tiers <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">Job listings</h2>
        {jobs && jobs.length > 0 ? (
          <div className="divide-y">
            {jobs.map((job: any) => (
              <div key={job.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{job.companies?.name} &middot; {job.status}</p>
                </div>
                <form action="/api/admin/deepedge/jobs/close" method="POST">
                  <input type="hidden" name="job_id" value={job.id} />
                  <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                    Close listing
                  </button>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm dark:text-gray-400">No active job listings.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 dark:bg-gray-900">
        <h2 className="text-lg font-semibold mb-4">Users</h2>
        <div className="divide-y">
          {users?.map((u) => (
            <div key={u.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{u.full_name || u.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
              </div>
              <form action="/api/admin/deepedge/users/update-role" method="POST" className="flex items-center gap-2">
                <input type="hidden" name="user_id" value={u.id} />
                <select
                  name="role"
                  defaultValue={u.role}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 capitalize dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  {['candidate', 'employer', 'admin'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                  Update
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
