import { redirect } from 'next/navigation'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { createClient } from '@/lib/supabase/server'

export default async function PostFutureRolePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/post')

  const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle()
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()
  const { data: company } = await supabase.from('companies').select('id, name').eq('user_id', user.id).maybeSingle()

  if (!company) {
    return (
      <WorkspaceShell
        hasCompany={false}
        userName={profile?.full_name || 'User'}
        verified={!!scoreRow?.is_verified_expert}
        greyinScore={scoreRow?.greyin_score ?? null}
      role={profile?.role}
        pageTitle="Post a Future Role"
      >
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-3 dark:text-gray-50">Set up your company first</h1>
          <p className="text-gray-600 mb-6 dark:text-gray-400">
            Posting a future role needs a company profile — that lives on DeepEdge and is shared across
            every Greyin pillar.
          </p>
          <a href="https://deepedge.greyin.net/employer/dashboard" className="inline-block bg-amber-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-800 transition">
            Set Up Your Company on DeepEdge
          </a>
        </div>
      </WorkspaceShell>
    )
  }

  return (
    <WorkspaceShell
      activeSection="post"
      hasCompany={true}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Post a Future Role"
    >
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 dark:text-gray-50">Post a Future Role</h1>
        <p className="text-gray-600 mb-8 dark:text-gray-400">
          Posting as <span className="font-semibold">{company.name}</span> &mdash; but members never see that.
          Write the description without naming your company, team, product, or anything else that would give
          it away.
        </p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
            {decodeURIComponent(error)}
          </div>
        )}

        <form action="/api/future-roles/create" method="POST" className="bg-white rounded-xl border border-gray-200 p-7 space-y-5 dark:bg-gray-900 dark:border-gray-800">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Role title</label>
            <input name="title" type="text" required placeholder="e.g. Director of Engineering"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Function area</label>
              <input name="function_area" type="text" placeholder="Engineering"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Seniority level</label>
              <input name="seniority_level" type="text" placeholder="Director"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">When do you expect to hire?</label>
            <select name="target_timeframe" required defaultValue="6_months"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
              <option value="3_months">~3 months from now</option>
              <option value="6_months">~6 months from now</option>
              <option value="9_months">~9 months from now</option>
              <option value="12_months">~12 months from now</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Description</label>
            <textarea name="description" rows={6} required
              placeholder="What the role will own, what success looks like -- without naming your company or anything that identifies it."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Skills</label>
            <input name="skills" type="text" placeholder="e.g. Kubernetes, team leadership, fintech"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Separate with commas -- this drives AI matching</p>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Location</label>
              <input name="location" type="text" placeholder="City, Country"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>
            <label className="flex items-center gap-2 pb-2.5">
              <input name="is_remote" type="checkbox" value="true" className="w-4 h-4 text-amber-700 rounded focus:ring-amber-500 dark:text-amber-400 dark:bg-gray-950 dark:text-gray-100" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Remote OK</span>
            </label>
          </div>

          <button type="submit" className="w-full py-3 rounded-lg bg-amber-700 text-white hover:bg-amber-800 font-semibold">
            Post Future Role
          </button>
        </form>
      </div>
    </WorkspaceShell>
  )
}
