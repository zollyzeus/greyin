import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function PostJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/employer/post-job')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employer') {
    redirect('/dashboard')
  }

  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  return (
    <WorkspaceShell
      variant="employer"
      activeSection="post-job"
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Post a Job"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/employer/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="bg-white rounded-lg shadow p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">Post a New Job</h1>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
              {decodeURIComponent(error)}
            </div>
          )}

          <form action="/api/jobs/create" method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job title</label>
              <input id="title" name="title" type="text" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="Senior Embedded Systems Engineer" />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea id="description" name="description" rows={6} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                <input id="location" name="location" type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Bengaluru, India" />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <input id="category" name="category" type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  placeholder="Engineering" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="remote_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Work type</label>
                <select id="remote_type" name="remote_type" defaultValue="hybrid"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </div>
              <div>
                <label htmlFor="employment_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employment type</label>
                <select id="employment_type" name="employment_type" defaultValue="full-time"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="salary_min" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Salary min</label>
                <input id="salary_min" name="salary_min" type="number" min={0}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
              <div>
                <label htmlFor="salary_max" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Salary max</label>
                <input id="salary_max" name="salary_max" type="number" min={0}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" name="salary_disclosed" value="true" className="rounded dark:bg-gray-950 dark:text-gray-100" />
              Publicly disclose this range — feeds the platform&rsquo;s k-anonymized salary trend graphs (never shown as a single data point)
            </label>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="experience_min" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Min experience (years)</label>
                <input id="experience_min" name="experience_min" type="number" min={0}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
              <div>
                <label htmlFor="experience_max" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max experience (years)</label>
                <input id="experience_max" name="experience_max" type="number" min={0}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
            </div>

            <div>
              <label htmlFor="skills_required" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Required skills (comma separated)</label>
              <input id="skills_required" name="skills_required" type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="Rust, AUTOSAR, CAN bus" />
            </div>

            <label className="flex items-start gap-2">
              <input type="checkbox" id="open_to_career_changers" name="open_to_career_changers"
                className="h-4 w-4 mt-0.5 text-indigo-600 rounded dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Open to career changers</span> — accept applications from Verified
                Experts tagged as pivoting into this domain, even without direct experience in it.
              </span>
            </label>

            <label className="flex items-start gap-2">
              <input type="checkbox" id="open_to_reentry" name="open_to_reentry"
                className="h-4 w-4 mt-0.5 text-indigo-600 rounded dark:text-indigo-400 dark:bg-gray-950 dark:text-gray-100" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Open to candidates with career gaps</span> — a public signal that
                you don&apos;t screen out candidates returning to work after a caregiving, health, layoff, or
                other gap. Every Verified Expert can already apply to this job regardless of this flag.
              </span>
            </label>

            <div>
              <label htmlFor="feed_visibility" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Show in followers&rsquo; feed</label>
              <select id="feed_visibility" name="feed_visibility" defaultValue="public"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="public">Public</option>
                <option value="followers">Followers only</option>
                <option value="private">Don&rsquo;t include</option>
              </select>
            </div>

            <button type="submit"
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-semibold">
              Publish Job
            </button>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  )
}
