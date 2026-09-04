import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isBuilder } from '@/lib/stackworks-role'
import { FlaskConical, ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function NewAskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/projects/${id}/asks/new`)
  }

  const { data: project } = await supabase
    .from('builder_projects')
    .select('id, title, user_id')
    .eq('id', id)
    .single()

  if (!project) {
    notFound()
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('years_experience, stackworks_role')
    .eq('id', user.id)
    .single()

  if (project.user_id !== user.id || !profile || !isBuilder(profile)) {
    redirect(`/projects/${id}`)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://greyin.net" className="flex items-center">
              <FlaskConical className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              <span className="ml-2 text-2xl font-bold">StackWorks</span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href={`/projects/${id}`} className="flex items-center text-gray-600 hover:text-teal-600 mb-6 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {project.title}
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 dark:text-gray-50">Post an Ask</h1>

          <form action={`/api/projects/${id}/asks/create`} method="POST" className="space-y-6">
            <div>
              <label htmlFor="role_title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
              <input id="role_title" name="role_title" type="text" required
                placeholder="Frontend — onboarding flow"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="skills" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Skills needed (comma separated)</label>
              <input id="skills" name="skills" type="text"
                placeholder="React, Tailwind"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea id="description" name="description" rows={5}
                placeholder="What does this role actually involve?"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            </div>

            <div>
              <label htmlFor="verification_criteria" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Verification criteria (optional)
              </label>
              <textarea id="verification_criteria" name="verification_criteria" rows={3}
                placeholder="Test cases or expected output you'd like submitted work checked against"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">If set, AI verification checks submitted work against this specifically instead of just the description above.</p>
            </div>

            <button type="submit"
              className="w-full bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 font-semibold">
              Post Ask
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
