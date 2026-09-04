import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FlaskConical, ArrowLeft, ShieldCheck, Bot } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

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

  // No cron in this deployment -- catch up any outcome whose 14-day
  // review window lapsed with nobody reviewing it before this page reads
  // verified_outcomes below.
  await supabase.rpc('finalize_expired_verified_outcomes')

  const { data: pendingOutcomes } = await supabase
    .from('verified_outcomes')
    .select(
      'id, outcome_type, notes, evidence_url, ai_score, ai_notes, created_at, review_deadline, profiles:subject_user_id ( full_name ), project_applications:application_id ( project_asks:ask_id ( role_title ) ), builder_projects:project_id ( title )'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: projects } = await supabase
    .from('builder_projects')
    .select('id, title')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: asks } = await supabase
    .from('project_asks')
    .select('id, role_title')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <FlaskConical className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              <span className="ml-2 text-2xl font-bold">StackWorks</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-teal-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Admin</h1>
          </div>
          <a href="https://greyin.net/admin/llm" className="flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
            <Bot className="h-4 w-4" />
            AI Providers
          </a>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Projects</h2>
          {projects && projects.length > 0 ? (
            <div className="divide-y">
              {projects.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <p className="font-medium">{p.title}</p>
                  <form action="/api/admin/projects/delete" method="POST">
                    <input type="hidden" name="project_id" value={p.id} />
                    <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No projects yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Asks</h2>
          {asks && asks.length > 0 ? (
            <div className="divide-y">
              {asks.map((a) => (
                <div key={a.id} className="py-3 flex items-center justify-between">
                  <p className="font-medium">{a.role_title}</p>
                  <form action="/api/admin/asks/delete" method="POST">
                    <input type="hidden" name="ask_id" value={a.id} />
                    <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      Delete
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No asks yet.</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6 dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4">Verifications</h2>
          {pendingOutcomes && pendingOutcomes.length > 0 ? (
            <div className="divide-y">
              {pendingOutcomes.map((o: any) => (
                <div key={o.id} className="py-4">
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <p className="font-medium">
                      {o.profiles?.full_name || 'User'} —{' '}
                      {o.outcome_type === 'project_shipped'
                        ? `${o.builder_projects?.title || 'Project'} (self-submitted, review required)`
                        : o.project_applications?.project_asks?.role_title || 'Untitled ask'}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Deadline {new Date(o.review_deadline).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line mb-2 dark:text-gray-300">{o.notes}</p>
                  <p className="text-xs text-gray-500 mb-2 dark:text-gray-400">
                    {o.ai_score !== null ? `AI score: ${o.ai_score}/100 — ${o.ai_notes}` : 'AI review unavailable'}
                  </p>
                  <form action={`/api/verified-outcomes/${o.id}/human-review`} method="POST" className="flex items-center gap-2 flex-wrap">
                    <input type="hidden" name="redirect_to" value="/admin" />
                    <input
                      name="human_score"
                      type="number"
                      min={0}
                      max={100}
                      required
                      placeholder="Score"
                      className="w-24 text-sm border border-gray-300 rounded-lg px-3 py-1.5 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <input
                      name="human_notes"
                      type="text"
                      placeholder="Notes (optional)"
                      className="flex-1 min-w-[12rem] text-sm border border-gray-300 rounded-lg px-3 py-1.5 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                    <button type="submit" className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
                      Resolve
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm dark:text-gray-400">No verifications pending review.</p>
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
                <form action="/api/admin/users/update-role" method="POST" className="flex items-center gap-2">
                  <input type="hidden" name="user_id" value={u.id} />
                  <select
                    name="role"
                    defaultValue={u.role}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 capitalize dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  >
                    {['supporter', 'member', 'admin'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button type="submit" className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
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
