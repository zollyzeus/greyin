import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, ArrowLeft, ShieldCheck } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

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
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <Briefcase className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-2xl font-bold">DeepEdge</span>
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/admin/subscriptions" className="text-indigo-600 hover:text-indigo-700">Subscriptions</Link>
            <a href="https://greyin.net/admin/threshold-votes" className="text-indigo-600 hover:text-indigo-700">Threshold Votes</a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Job listings</h2>
          {jobs && jobs.length > 0 ? (
            <div className="divide-y">
              {jobs.map((job: any) => (
                <div key={job.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{job.title}</p>
                    <p className="text-xs text-gray-500">{job.companies?.name} &middot; {job.status}</p>
                  </div>
                  <form action="/api/admin/jobs/close" method="POST">
                    <input type="hidden" name="job_id" value={job.id} />
                    <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700">
                      Close listing
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No active job listings.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Users</h2>
          <div className="divide-y">
            {users?.map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{u.full_name || u.email}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <form action="/api/admin/users/update-role" method="POST" className="flex items-center gap-2">
                  <input type="hidden" name="user_id" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 capitalize"
                  >
                    {['candidate', 'employer', 'admin'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Update
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
