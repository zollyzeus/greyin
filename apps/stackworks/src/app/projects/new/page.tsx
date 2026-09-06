import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isBuilder } from '@/lib/stackworks-role'
import { MultiImageUploader } from '@/components/ImageUploader'
import { WorkspaceShell } from '@/components/WorkspaceShell'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/projects/new')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, years_experience, stackworks_role')
    .eq('id', user.id)
    .single()

  if (!profile || !isBuilder(profile)) {
    redirect('/dashboard')
  }
  const { data: scoreRow } = await supabase.from('greyin_scores').select('greyin_score, is_verified_expert').eq('user_id', user.id).maybeSingle()

  return (
    <WorkspaceShell
      activeSection="projects-new"
      builder={true}
      isAdmin={profile?.role === 'admin'}
      userName={profile?.full_name || 'User'}
      verified={!!scoreRow?.is_verified_expert}
      greyinScore={scoreRow?.greyin_score ?? null}
      pageTitle="Post a Project"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">Post a Project</h1>

          <form action="/api/projects/create" method="POST" className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project title</label>
              <input id="title" name="title" type="text" required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea id="description" name="description" rows={5} required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="tech_stack" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tech stack (comma separated)</label>
              <input id="tech_stack" name="tech_stack" type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                placeholder="Rust, Docker, K8s" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="github_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub URL</label>
                <input id="github_url" name="github_url" type="url"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
              <div>
                <label htmlFor="demo_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Demo URL</label>
                <input id="demo_url" name="demo_url" type="url"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select id="status" name="status" defaultValue="idea"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="idea">Idea</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Images</label>
              <MultiImageUploader name="images" folder="stackworks-projects" />
            </div>

            <button type="submit"
              className="w-full bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 font-semibold">
              Post Project
            </button>
          </form>
        </div>
      </div>
    </WorkspaceShell>
  )
}
