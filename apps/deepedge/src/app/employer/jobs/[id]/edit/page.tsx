import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Building2 } from 'lucide-react'

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/employer/jobs/${id}/edit`)
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('*, companies ( user_id )')
    .eq('id', id)
    .single()

  if (!job) {
    notFound()
  }

  if ((job.companies as any)?.user_id !== user.id) {
    redirect('/employer/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center gap-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-6 h-6" />
              DeepEdge
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/employer/dashboard" className="flex items-center text-gray-600 hover:text-indigo-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to dashboard
        </Link>

        <div className="bg-white rounded-lg shadow p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">Edit Job</h1>

          <form action={`/api/jobs/${id}/update`} method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job title</label>
              <input id="title" name="title" type="text" required defaultValue={job.title}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea id="description" name="description" rows={6} required defaultValue={job.description}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                <input id="location" name="location" type="text" defaultValue={job.location || ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <input id="category" name="category" type="text" defaultValue={job.category || ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="remote_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Work type</label>
                <select id="remote_type" name="remote_type" defaultValue={job.remote_type}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </div>
              <div>
                <label htmlFor="employment_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employment type</label>
                <select id="employment_type" name="employment_type" defaultValue={job.employment_type}
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
                <input id="salary_min" name="salary_min" type="number" min={0} defaultValue={job.salary_min ?? ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
              <div>
                <label htmlFor="salary_max" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Salary max</label>
                <input id="salary_max" name="salary_max" type="number" min={0} defaultValue={job.salary_max ?? ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" name="salary_disclosed" value="true" defaultChecked={!!job.salary_disclosed} className="rounded dark:bg-gray-950 dark:text-gray-100" />
                Publicly disclose this range — feeds the platform&rsquo;s k-anonymized salary trend graphs (never shown as a single data point)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="experience_min" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Min experience (years)</label>
                <input id="experience_min" name="experience_min" type="number" min={0} defaultValue={job.experience_min ?? ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
              <div>
                <label htmlFor="experience_max" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Max experience (years)</label>
                <input id="experience_max" name="experience_max" type="number" min={0} defaultValue={job.experience_max ?? ''}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
            </div>

            <div>
              <label htmlFor="skills_required" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Required skills (comma separated)</label>
              <input id="skills_required" name="skills_required" type="text" defaultValue={(job.skills_required || []).join(', ')}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select id="status" name="status" defaultValue={job.status}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="draft">Draft</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="filled">Filled</option>
              </select>
            </div>

            <button type="submit"
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-semibold">
              Save Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
